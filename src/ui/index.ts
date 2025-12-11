/**
 * FazAI UI Components
 *
 * Exporta todos os componentes visuais para uso no CLI interativo
 */

// Table components
export {
  renderTable,
  statusColor,
  statusColors,
  type TableColumn,
  type TableOptions,
} from "./table";

// Spinner components
export { Spinner, withSpinner } from "./spinner";

// Prompt components
export {
  selectOption,
  confirmAction,
  inputText,
  inputSecret,
  selectWithDescription,
  inputWithValidation,
  type SelectOption,
} from "./prompt";

// Banner components
export {
  showBanner,
  showSection,
  showHeader,
  showSuccess,
  showError,
  showWarning,
  showInfo,
  showLogo,
  type BannerOptions,
} from "./banner";

// Menu components
export {
  showMenu,
  showSimpleMenu,
  showNestedMenu,
  confirmMenu,
  type MenuItem,
  type MenuOptions,
} from "./menu";

// Dashboard components
export {
  showDashboard,
  showMiniDashboard,
  type SystemInfo,
  type RecentCommand,
  type APIStatus,
  type DashboardOptions,
  type DashboardData,
  type Stat,
} from "./dashboard";
