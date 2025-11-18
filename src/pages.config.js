import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Transactions from './pages/Transactions';
import StudentDetail from './pages/StudentDetail';
import MT5Accounts from './pages/MT5Accounts';
import MyFundingRequests from './pages/MyFundingRequests';
import FundingRequests from './pages/FundingRequests';
import MyTargets from './pages/MyTargets';
import TargetsManagement from './pages/TargetsManagement';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Students": Students,
    "Transactions": Transactions,
    "StudentDetail": StudentDetail,
    "MT5Accounts": MT5Accounts,
    "MyFundingRequests": MyFundingRequests,
    "FundingRequests": FundingRequests,
    "MyTargets": MyTargets,
    "TargetsManagement": TargetsManagement,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};