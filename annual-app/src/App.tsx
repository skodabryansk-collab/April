import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AnnualBrandDashboard from "./AnnualBrandDashboard";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AnnualBrandDashboard />
    </QueryClientProvider>
  );
}
