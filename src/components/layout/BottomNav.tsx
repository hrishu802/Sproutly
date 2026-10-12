import { NavLink } from 'react-router-dom';
import {
  Home,
  Flower2,
  Stethoscope,
  MessageCircle,
  Target,
  BookOpen,
  Settings,
} from 'lucide-react';
import { useLanguage } from '../../context/AppContext';

const navItems = [
  { path: '/', icon: Home, labelKey: 'home' as const },
  { path: '/garden', icon: Flower2, labelKey: 'garden' as const },
  { path: '/plant-doctor', icon: Stethoscope, labelKey: 'plantDoctor' as const },
  { path: '/coach', icon: MessageCircle, labelKey: 'coach' as const },
  { path: '/missions', icon: Target, labelKey: 'missions' as const },
  { path: '/journal', icon: BookOpen, labelKey: 'journal' as const },
  { path: '/settings', icon: Settings, labelKey: 'settings' as const },
] as const;

export default function BottomNav() {
  const { t } = useLanguage();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-t border-sage-100 safe-area-pb"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-lg mx-auto flex justify-around items-center px-1 py-1">
        {navItems.map(({ path, icon: Icon, labelKey }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors duration-150 min-w-[3rem] ${
                isActive
                  ? 'text-forest-600 bg-sage-50'
                  : 'text-sage-400 hover:text-sage-600'
              }`
            }
            aria-label={t.nav[labelKey]}
          >
            <Icon className="w-5 h-5" strokeWidth={1.8} />
            <span className="text-[10px] font-medium leading-tight truncate max-w-[4rem]">
              {t.nav[labelKey]}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
