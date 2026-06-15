/** The category tree. Icons are lucide-react names resolved in CategoryGrid. */
import type { CategorySlug } from './providers/types';

export interface Category {
  slug: CategorySlug;
  icon: string; // lucide icon name
  /** Subcategories are display-only filters for v1 (mapped to search terms). */
  subcategories: string[];
}

export const CATEGORIES: Category[] = [
  { slug: 'electronics',  icon: 'MonitorSmartphone', subcategories: ['TV & Audio', 'Phones', 'Computers', 'Gaming', 'Appliances'] },
  { slug: 'fashion',      icon: 'Shirt',             subcategories: ['Women', 'Men', 'Kids', 'Shoes', 'Accessories'] },
  { slug: 'home-garden',  icon: 'Sofa',              subcategories: ['Furniture', 'Kitchen', 'DIY & Tools', 'Garden', 'Lighting'] },
  { slug: 'sports',       icon: 'Bike',              subcategories: ['Fitness', 'Cycling', 'Running', 'Outdoor', 'Winter Sports'] },
  { slug: 'beauty',       icon: 'Sparkles',          subcategories: ['Skincare', 'Fragrance', 'Hair', 'Makeup', 'Personal Care'] },
  { slug: 'food-grocery', icon: 'ShoppingBasket',    subcategories: ['Coffee & Tea', 'Pantry', 'Drinks', 'Snacks', 'Organic'] },
  { slug: 'toys',         icon: 'Blocks',            subcategories: ['Building Sets', 'Games', 'Outdoor Play', 'Educational', 'Plush'] },
  { slug: 'automotive',   icon: 'Car',               subcategories: ['Tyres', 'Accessories', 'Care', 'Electronics', 'Child Seats'] },
  { slug: 'books',        icon: 'BookOpen',          subcategories: ['Fiction', 'Non-Fiction', 'Children', 'Comics', 'Learning'] },
  { slug: 'travel',       icon: 'Plane',             subcategories: ['Luggage', 'City Breaks', 'Packages', 'Gear', 'Accessories'] },
];
