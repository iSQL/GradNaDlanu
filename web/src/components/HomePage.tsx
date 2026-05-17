import { useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';
import { Hero } from './Hero';
import { HomeDashboard } from './HomeDashboard';

export function HomePage() {
  const { homeView } = useOutletContext<AppContext>();
  return homeView === 'dashboard' ? <HomeDashboard /> : <Hero />;
}
