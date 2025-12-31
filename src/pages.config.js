import AIInsights from './pages/AIInsights';
import AuditLogs from './pages/AuditLogs';
import CommissionReports from './pages/CommissionReports';
import Commissions from './pages/Commissions';
import Dashboard from './pages/Dashboard';
import FundingRequests from './pages/FundingRequests';
import GamificationSettings from './pages/GamificationSettings';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import MT5Accounts from './pages/MT5Accounts';
import MentorPerformance from './pages/MentorPerformance';
import MentorTraining from './pages/MentorTraining';
import MyCommissionHistory from './pages/MyCommissionHistory';
import MyFundingRequests from './pages/MyFundingRequests';
import MyStudentRequests from './pages/MyStudentRequests';
import MyTargets from './pages/MyTargets';
import Personnel from './pages/Personnel';
import QuarterClosing from './pages/QuarterClosing';
import StudentDetail from './pages/StudentDetail';
import StudentRequestApprovals from './pages/StudentRequestApprovals';
import Students from './pages/Students';
import TargetsManagement from './pages/TargetsManagement';
import Tickets from './pages/Tickets';
import Transactions from './pages/Transactions';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIInsights": AIInsights,
    "AuditLogs": AuditLogs,
    "CommissionReports": CommissionReports,
    "Commissions": Commissions,
    "Dashboard": Dashboard,
    "FundingRequests": FundingRequests,
    "GamificationSettings": GamificationSettings,
    "Home": Home,
    "Leaderboard": Leaderboard,
    "MT5Accounts": MT5Accounts,
    "MentorPerformance": MentorPerformance,
    "MentorTraining": MentorTraining,
    "MyCommissionHistory": MyCommissionHistory,
    "MyFundingRequests": MyFundingRequests,
    "MyStudentRequests": MyStudentRequests,
    "MyTargets": MyTargets,
    "Personnel": Personnel,
    "QuarterClosing": QuarterClosing,
    "StudentDetail": StudentDetail,
    "StudentRequestApprovals": StudentRequestApprovals,
    "Students": Students,
    "TargetsManagement": TargetsManagement,
    "Tickets": Tickets,
    "Transactions": Transactions,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};