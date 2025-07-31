export const PROFESSIONAL_CATEGORIES = {
  BARBER: {
    id: 1,
    name: 'Barber',
    slug: 'barber',
    icon: 'scissors',
    description: 'Haircuts, beard trims, and styling',
    defaultServices: ['Haircut', 'Beard Trim', 'Hair Styling']
  },
  HAIR_STYLIST: {
    id: 2,
    name: 'Hair Stylist',
    slug: 'hair-stylist',
    icon: 'cut',
    description: 'Haircuts, coloring, and treatments',
    defaultServices: ['Haircut', 'Hair Color', 'Hair Treatment']
  },
  NAIL_TECH: {
    id: 3,
    name: 'Nail Technician',
    slug: 'nail-tech',
    icon: 'nail-polish',
    description: 'Manicures, pedicures, and nail art',
    defaultServices: ['Manicure', 'Pedicure', 'Nail Art']
  },
  MAKEUP_ARTIST: {
    id: 4,
    name: 'Makeup Artist',
    slug: 'makeup-artist',
    icon: 'makeup',
    description: 'Makeup application and lessons',
    defaultServices: ['Makeup Application', 'Makeup Lesson', 'Special Event Makeup']
  },
  TATTOO_ARTIST: {
    id: 5,
    name: 'Tattoo Artist',
    slug: 'tattoo-artist',
    icon: 'tattoo',
    description: 'Tattoos, piercings, and body art',
    defaultServices: ['Tattoo', 'Piercing', 'Tattoo Consultation']
  }
};

export const getCategoryById = (id) => {
  return Object.values(PROFESSIONAL_CATEGORIES).find(category => category.id === id);
};

export const getCategoryBySlug = (slug) => {
  return Object.values(PROFESSIONAL_CATEGORIES).find(category => category.slug === slug);
}; 