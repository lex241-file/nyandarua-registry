import { useAuth } from '../context/AuthContext';
import AdminHome from './AdminHome';
import UserHome from './UserHome';

export default function Home() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminHome />;
  return <UserHome />;
}
