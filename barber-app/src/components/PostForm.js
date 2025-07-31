import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { barbers, handleApiError } from '../services/api';
import '../styles/PostForm.css';
import { useAuth } from '../contexts/AuthContext';
import { usePortfolio } from '../contexts/PortfolioContext';

// Utility function to generate a shorter filename
const generateShortFilename = (originalFile) => {
    // Get the file extension
    const extension = originalFile.name.split('.').pop().toLowerCase();
    // Generate a timestamp
    const timestamp = new Date().getTime();
    // Generate a random string (6 characters)
    const random = Math.random().toString(36).substring(2, 8);
    // Combine them into a new filename (timestamp_random.extension)
    const newFilename = `${timestamp}_${random}.${extension}`;
    return newFilename;
};

// Utility function to create a new File with a different name
const renameFile = (originalFile) => {
    const newFilename = generateShortFilename(originalFile);
    return new File([originalFile], newFilename, {
        type: originalFile.type,
        lastModified: originalFile.lastModified,
    });
};

// Add this utility function at the top with other utilities
const getFullImageUrl = (imagePath) => {
    // If the image path already starts with http/https, return it as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }
    // Otherwise, add the base URL
    return `http://127.0.0.1:8000${imagePath}`;
};

const PostForm = ({ onClose, onSuccess, postId = null, initialData = null }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { barberId } = useParams();

    // Add error handling for auth context
    const auth = useAuth();
    const { addPortfolioItem, createPortfolioGroup, updatePortfolioItem, loading: portfolioLoading } = usePortfolio();
    const user = auth?.user;
    const isProfessional = auth?.isProfessional;
    const profileData = auth?.profileData;
    const loading = auth?.loading;
    const fetchProfileData = auth?.fetchProfileData;  // Get the refresh function
    const updateProfileWithNewPost = auth?.updateProfileWithNewPost;  // Get the update function

    const [selectedImages, setSelectedImages] = useState([]);
    const [previewUrls, setPreviewUrls] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [caption, setCaption] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [postType, setPostType] = useState('individual');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [currentPostId, setPostId] = useState(postId);
    const [hasChanges, setHasChanges] = useState(false);

    // Add auth state check
    useEffect(() => {
        if (!auth) {
            console.error('Auth context not available');
            navigate('/login', {
                state: { from: location.pathname },
                replace: true
            });
            return;
        }
    }, [auth, navigate, location.pathname]);

    // Handle edit mode initialization
    useEffect(() => {
        console.log('=== PostForm Edit Mode Debug ===');
        console.log('Location state:', location.state);
        console.log('Edit mode flag:', location.state?.editMode);
        console.log('Post data:', location.state?.postData);
        
        if (location.state?.editMode && location.state?.postData) {
            console.log('Initializing edit mode with post data:', location.state.postData);
            const { postData } = location.state;
            
            // Debug the post data structure
            console.log('Post data structure:', {
                id: postData.id,
                description: postData.description,
                image: postData.image,
                images: postData.images,
                is_group_post: postData.is_group_post,
                group_images: postData.group_images
            });
            
            // Debug each property individually
            console.log('Individual properties:');
            console.log('- postData.image:', postData.image, typeof postData.image);
            console.log('- postData.images:', postData.images, Array.isArray(postData.images));
            if (postData.images && Array.isArray(postData.images)) {
                postData.images.forEach((img, index) => {
                    console.log(`- postData.images[${index}]:`, img);
                    console.log(`- postData.images[${index}].image:`, img?.image, typeof img?.image);
                });
            }
            
            setEditMode(true);
            setPostId(postData.id);
            setPostType(postData.is_group_post ? 'group' : 'individual');
            setCaption(postData.description || '');

            // Convert existing images to preview URLs using the same logic as BarberProfile
            let imageUrls = [];
            
            if (postData.is_group_post && postData.group_images) {
                // Group post - use group_images
                imageUrls = postData.group_images.map(img => {
                    console.log('Processing group image:', img);
                    return getFullImageUrl(img.image);
                });
            } else if (postData.image) {
                // Single post - use image
                console.log('Processing single image:', postData.image);
                imageUrls = [getFullImageUrl(postData.image)];
            }

            console.log('Generated image URLs:', imageUrls);
            console.log('Original post data:', {
                is_group_post: postData.is_group_post,
                group_images: postData.group_images,
                image: postData.image
            });
            setPreviewUrls(imageUrls);
            setHasChanges(false); // Reset changes flag
        } else {
            console.log('Not in edit mode or missing post data');
        }
    }, [location.state]);

    // Update hasChanges when caption changes
    useEffect(() => {
        if (editMode) {
            const originalCaption = location.state?.postData?.description || '';
            const hasNewImages = selectedImages.length > 0;
            const hasCaptionChange = caption !== originalCaption;
            setHasChanges(hasNewImages || hasCaptionChange);
        }
    }, [caption, selectedImages, editMode, location.state]);

    // Check if user has a barber profile and is logged in
    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate('/login', {
                    state: { from: location.pathname },
                    replace: true
                });
            } else if (!isProfessional || !profileData) {
                navigate('/complete-barber-profile', {
                    state: { from: location.pathname },
                    replace: true
                });
            }
        }
    }, [user, isProfessional, profileData, navigate, loading, location.pathname]);

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        const validImageFiles = files.filter(file => file.type.startsWith('image/'));

        if (validImageFiles.length > 0) {
            // Rename files before creating object URLs
            const renamedFiles = validImageFiles.map(file => renameFile(file));
            const newUrls = renamedFiles.map(file => URL.createObjectURL(file));
            setSelectedImages(prev => [...prev, ...renamedFiles]);
            setPreviewUrls(prev => [...prev, ...newUrls]);
        } else {
            alert('Please select image files');
        }
        
        // Clear the input value so the same file can be selected again
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const validImageFiles = files.filter(file => file.type.startsWith('image/'));

        if (validImageFiles.length > 0) {
            // Rename files before creating object URLs
            const renamedFiles = validImageFiles.map(file => renameFile(file));
            const newUrls = renamedFiles.map(file => URL.createObjectURL(file));
            setSelectedImages(prev => [...prev, ...renamedFiles]);
            setPreviewUrls(prev => [...prev, ...newUrls]);
        } else {
            alert('Please drop image files');
        }
        
        // Clear the file input value after drag and drop
        const fileInput = document.getElementById('image-upload');
        if (fileInput) {
            fileInput.value = '';
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const removeImage = (index) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
        setPreviewUrls(prev => prev.filter((_, i) => i !== index));
        if (currentImageIndex >= index && currentImageIndex > 0) {
            setCurrentImageIndex(prev => prev - 1);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const formData = new FormData();
            let response;

            if (editMode) {
                // Handle edit mode
                if (selectedImages.length > 0) {
                    const image = selectedImages[0];
                    formData.append('image', image);
                    console.log('Added new image to FormData:', image.name);
                } else {
                    // Use existing image based on post type
                    const postData = location.state?.postData;
                    if (postData.is_group_post && postData.group_images?.[0]?.image) {
                        const existingImageUrl = postData.group_images[0].image;
                        formData.append('existing_image', existingImageUrl);
                        console.log('Using existing group image:', existingImageUrl);
                    } else if (postData.image) {
                        const existingImageUrl = postData.image;
                    formData.append('existing_image', existingImageUrl);
                        console.log('Using existing single image:', existingImageUrl);
                    }
            }

                if (caption.trim()) {
                    formData.append('description', caption);
                    console.log('Added caption to FormData:', caption);
                }

                try {
                    const { response: updateResponse } = await updatePortfolioItem(barberId, currentPostId, formData);
                    response = updateResponse;
                    console.log('Update response:', response);
                } catch (updateError) {
                    console.error('Error updating post:', updateError);
                    throw updateError;
                }
            } else {
                // For new posts
            if (selectedImages.length === 0) {
                setError('Please select at least one image');
                setIsSubmitting(false);
                return;
            }

                // Always add barber id to FormData for all post types
                formData.append('barber', barberId);

                // Check if it's a group post (multiple images)
                if (selectedImages.length > 1) {
                    console.log('Creating group post with multiple images');

                    // Add all images to formData
                selectedImages.forEach((image, index) => {
                    formData.append('images', image);
                        console.log(`Added image ${index + 1} to FormData:`, image.name);
                });

                    // Add group flag
                    formData.append('is_group', 'true');

                if (caption.trim()) {
                    formData.append('description', caption);
                        console.log('Added caption to FormData:', caption);
                }

                    try {
                        const { response: groupResponse } = await createPortfolioGroup(barberId, formData);
                        response = groupResponse;
                        console.log('Group creation response:', response);
                    } catch (groupError) {
                        console.error('Error creating group post:', groupError);
                        throw groupError;
                    }
                } else {
                    // Single image post
                    console.log('Creating single image post');
                const image = selectedImages[0];
                formData.append('image', image);
                    console.log('Added image to FormData:', image.name);

                if (caption.trim()) {
                    formData.append('description', caption);
                        console.log('Added caption to FormData:', caption);
                }

                    try {
                    const { response: addResponse } = await addPortfolioItem(barberId, formData);
                    response = addResponse;
                        console.log('Single post creation response:', response);
                    } catch (addError) {
                        console.error('Error creating single post:', addError);
                        throw addError;
                    }
                }
            }

            if (onSuccess && onClose) {
                onSuccess(response.data);
                onClose();
            } else {
                navigate(`/barber-profile/${barberId}`);
            }
        } catch (error) {
            console.error('Error details:', error);
            console.error('Error response:', error.response);
            if (error.response?.status === 400) {
                setError('Invalid data. Please check your input and try again.');
            } else if (error.response?.status === 401) {
                setError('Your session has expired. Please log in again.');
            } else if (error.response?.status === 413) {
                setError('File size too large. Please select smaller images.');
            } else {
                const { message } = handleApiError(error);
                setError(message || 'An error occurred while saving your post. Please try again.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Update cancel button to handle both scenarios
    const handleCancel = () => {
        if (onClose) {
            onClose();
        } else {
            navigate(`/barber-profile/${barberId}`);
        }
    };

    return (
        <div className="post-form-container">
            <header className="post-form-header">
                <button className="cancel-button" onClick={handleCancel}>Cancel</button>
                <h2>{editMode ? 'Edit Post' : 'New Post'}</h2>
                <button
                    className="share-button"
                    onClick={handleSubmit}
                    disabled={(!editMode && selectedImages.length === 0) || isSubmitting || (editMode && !hasChanges)}
                >
                    {isSubmitting ? 'Saving...' : (editMode ? 'Save' : 'Share')}
                </button>
            </header>

            <div className="post-form-content">
                {error && (
                    <div className="error-message" style={{
                        textAlign: 'center',
                        width: '100%',
                        padding: '12px',
                        backgroundColor: '#ffebee',
                        color: '#d32f2f',
                        borderRadius: '4px',
                        margin: '10px 0',
                        fontSize: '14px'
                    }}>
                        {error}
                    </div>
                )}

                <input
                    type="file"
                    id="image-upload"
                    accept="image/*"
                    onChange={handleImageChange}
                    multiple
                    style={{ display: 'none' }}
                />

                {previewUrls.length === 0 ? (
                    <div
                        className="image-upload-section"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        <label htmlFor="image-upload" className="upload-label">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                            </svg>
                            <p>{editMode ? 'Select new photos' : 'Drag and drop or click to upload multiple photos'}</p>
                        </label>
                    </div>
                ) : (
                    <div className="preview-section">
                        <div className="carousel-container">
                            <img
                                src={previewUrls[currentImageIndex]}
                                alt={`Preview ${currentImageIndex + 1}`}
                                className="image-preview"
                                onClick={() => document.getElementById('image-upload').click()}
                                style={{ cursor: 'pointer' }}
                            />
                            {previewUrls.length > 1 && (
                                <>
                                    <button
                                        className="carousel-button prev"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentImageIndex(prev => prev > 0 ? prev - 1 : previewUrls.length - 1);
                                        }}
                                        aria-label="Previous image"
                                    >
                                        ‹
                                    </button>
                                    <button
                                        className="carousel-button next"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentImageIndex(prev => prev < previewUrls.length - 1 ? prev + 1 : 0);
                                        }}
                                        aria-label="Next image"
                                    >
                                        ›
                                    </button>
                                </>
                            )}
                            <div className="carousel-indicators">
                                {previewUrls.map((_, index) => (
                                    <button
                                        key={index}
                                        className={`carousel-dot ${index === currentImageIndex ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCurrentImageIndex(index);
                                        }}
                                        aria-label={`Go to image ${index + 1}`}
                                    />
                                ))}
                            </div>
                                <button
                                    className="remove-image-button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removeImage(currentImageIndex);
                                    }}
                                    aria-label="Remove current image"
                                >
                                    ×
                                </button>
                        </div>
                        
                        {/* Add More Photos Button */}
                        <div className="add-more-photos-section">
                            <button
                                className="add-more-photos-button"
                                onClick={() => document.getElementById('image-upload').click()}
                                type="button"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                                </svg>
                                Add More Photos
                            </button>
                        </div>
                        
                        <div className="caption-section">
                            <textarea
                                placeholder="Add a caption (optional)..."
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                maxLength={2200}
                                autoFocus
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PostForm; 