import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { LoginCardSeparated } from "@/components/shared-assets/login/login-card-separated";
import { SignupCardSeparated } from "@/components/shared-assets/login/signup-card-separated";
import { DashboardPage } from "@/pages/dashboard-page";
import { ForeclosureForm } from "@/pages/foreclosure-form";
import { NotFound } from "@/pages/not-found";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider>
            <BrowserRouter>
                <RouteProvider>
                    <Routes>
                        <Route path="/" element={<LoginCardSeparated />} />
                        <Route path="/signup" element={<SignupCardSeparated />} />
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/foreclosure-form" element={<ForeclosureForm />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </RouteProvider>
            </BrowserRouter>
        </ThemeProvider>
    </StrictMode>,
);
