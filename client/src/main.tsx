import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import { LoginCardSeparated } from "@/components/shared-assets/login/login-card-separated";
import { SignupCardSeparated } from "@/components/shared-assets/login/signup-card-separated";
import { DashboardPage } from "@/pages/dashboard-page";
import { ForeclosureForm } from "@/pages/foreclosure-form";
import { Settings01 } from "@/pages/settings";
import { ForgotPasswordPage } from "@/pages/forgot-password";
import { NotFound } from "@/pages/not-found";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AuthProvider } from "@/hooks/useAuth";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <RouteProvider>
                        <Routes>
                            <Route path="/" element={<LoginCardSeparated />} />
                            <Route path="/signup" element={<SignupCardSeparated />} />
                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                            <Route path="/foreclosure-form" element={<ProtectedRoute><ForeclosureForm /></ProtectedRoute>} />
                            <Route path="/settings" element={<ProtectedRoute><Settings01 /></ProtectedRoute>} />
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </RouteProvider>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    </StrictMode>,
);
