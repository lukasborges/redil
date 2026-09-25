import {
	Bike, BookOpen, Briefcase, Building2, Camera, ChartLine, Code, Coffee, Dumbbell, Film, FlaskConical, Gamepad2, Globe,
	GraduationCap, Headphones, Heart, House, Leaf, Moon, Music, Palette, PawPrint, Plane, Rocket, ShoppingCart, Star, Sun, Users, Wrench,
	type IconNode
} from 'lucide';
import type { WorkspaceIcon } from '../shared/workspace.ts';

// Lucide's line icons, ISC licensed: drawn in strokes, as GNOME's symbolic icons are.
export const WORKSPACE_ICON_NODES: Record<WorkspaceIcon, IconNode> = {
	'briefcase': Briefcase, 'house': House, 'heart': Heart, 'star': Star, 'code': Code, 'book-open': BookOpen,
	'music': Music, 'camera': Camera, 'gamepad': Gamepad2, 'globe': Globe, 'leaf': Leaf, 'coffee': Coffee,
	'rocket': Rocket, 'graduation-cap': GraduationCap, 'shopping-cart': ShoppingCart, 'plane': Plane, 'users': Users,
	'flask': FlaskConical, 'palette': Palette, 'chart': ChartLine, 'film': Film, 'bike': Bike, 'dumbbell': Dumbbell,
	'paw-print': PawPrint, 'wrench': Wrench, 'building': Building2, 'headphones': Headphones, 'sun': Sun, 'moon': Moon
};
