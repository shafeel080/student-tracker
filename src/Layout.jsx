import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  Award, 
  Target, 
  Ticket,
  DollarSign,
  Menu,
  X,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Layout({ children, currentPageName }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        base44.auth.redirectToLogin();
      }
    };
    fetchUser();
  }, []);

  const handleLogout = () => {
    base44.auth.logout();
  };

  const navigation = [
    { name: 'Dashboard', href: createPageUrl('Dashboard'), icon: LayoutDashboard, roles: ['all'] },
    { name: 'Leaderboard', href: createPageUrl('Leaderboard'), icon: Award, roles: ['all'] },
    { name: 'MentorPerformance', href: createPageUrl('MentorPerformance'), icon: Award, roles: ['all'] },
    { name: 'AI Assistant', href: createPageUrl('AIAssistant'), icon: Award, roles: ['all'] },
    { name: 'Performance Feedback', href: createPageUrl('PerformanceFeedback'), icon: Award, roles: ['all'] },
    { name: 'Personnel', href: createPageUrl('Personnel'), icon: Users, roles: ['super_admin', 'admin', 'academic_head', 'academic_admin'] },
    { name: 'Students', href: createPageUrl('Students'), icon: Users, roles: ['all'] },
    { name: 'MT5Accounts', href: createPageUrl('MT5Accounts'), icon: TrendingUp, roles: ['all'] },
    { name: 'FundingActivities', href: createPageUrl('MyFundingRequests'), icon: DollarSign, roles: ['senior_mentor', 'junior_mentor'] },
    { name: 'FundingRequests', href: createPageUrl('FundingRequests'), icon: DollarSign, roles: ['super_admin', 'broker_admin', 'academic_head', 'academic_admin'] },
    { name: 'MyTargets', href: createPageUrl('MyTargets'), icon: Target, roles: ['senior_mentor', 'junior_mentor'] },
    { name: 'TargetsManagement', href: createPageUrl('TargetsManagement'), icon: Target, roles: ['super_admin', 'broker_admin', 'academic_head', 'academic_admin'] },
    { name: 'MyCommissionHistory', href: createPageUrl('MyCommissionHistory'), icon: Award, roles: ['senior_mentor', 'junior_mentor'] },
    { name: 'QuarterClosing', href: createPageUrl('QuarterClosing'), icon: Award, roles: ['super_admin', 'broker_admin'] },
    { name: 'CommissionReports', href: createPageUrl('CommissionReports'), icon: Award, roles: ['super_admin', 'broker_admin', 'academic_head', 'academic_admin', 'finance_admin'] },
    { name: 'GamificationSettings', href: createPageUrl('GamificationSettings'), icon: Target, roles: ['super_admin', 'academic_head'] },
    { name: 'Transactions', href: createPageUrl('Transactions'), icon: TrendingUp, roles: ['all'] },
    { name: 'Commissions', href: createPageUrl('Commissions'), icon: Award, roles: ['super_admin', 'broker_admin', 'academic_head', 'senior_mentor', 'junior_mentor'] },
    { name: 'Tickets', href: createPageUrl('Tickets'), icon: Ticket, roles: ['super_admin', 'academic_admin'] }
  ];

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes('all') || item.roles.includes(currentUser?.app_role)
  );

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        :root {
          --color-primary: 30 58 138;
          --color-secondary: 16 185 129;
          --color-accent: 245 158 11;
        }
      `}</style>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col bg-white border-r border-gray-200">
        <div className="flex flex-col flex-grow pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-6 mb-8">
            <Link to={createPageUrl('Dashboard')} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center">
                <Award className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Commission Portal</h1>
              </div>
            </Link>
          </div>

          <div className="px-4 mb-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <p className="text-sm font-semibold text-gray-900">{currentUser.full_name}</p>
              <p className="text-xs text-gray-600 mt-1">{currentUser.email}</p>
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {currentUser.app_role?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = currentPageName === item.name;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' 
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex-shrink-0 px-3 pb-4">
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="flex items-center justify-between p-4">
          <Link to={createPageUrl('Dashboard')} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center">
              <Award className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">Commission Portal</h1>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="px-2 pt-2 pb-3 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = currentPageName === item.name;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    group flex items-center px-3 py-2 text-sm font-medium rounded-lg
                    ${isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  {item.name}
                </Link>
              );
            })}
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start text-gray-700 hover:bg-gray-100"
            >
              <LogOut className="mr-3 h-5 w-5" />
              Logout
            </Button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        <main>{children}</main>
      </div>
    </div>
  );
}