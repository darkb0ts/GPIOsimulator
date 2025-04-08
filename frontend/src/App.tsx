import GpioSimulator from "./pages/gpio-simulator";
import { ThemeProvider } from "@/components/theme-provider"
import "./App.css"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <div className="flex h-screen w-screen items-center justify-center bg-background">
            <GpioSimulator />
      </div>
   
    </ThemeProvider>
  );
}

export default App

