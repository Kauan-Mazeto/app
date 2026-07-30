import StockManagement from "../atendente/StockManagement";

export default function StockDashboard() {
  return <StockManagement initialTab="entry" mode="secretario" />;
}