import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { UntitledLogoMinimal } from "@/components/foundations/logo/untitledui-logo-minimal";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { useNavigate } from "react-router";

type Step = "email" | "otp" | "password";

export const ForgotPasswordPage = () => {
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [resetToken, setResetToken] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleSendOtp = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData(e.currentTarget);
            const emailValue = formData.get("email") as string;

            const response = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailValue }),
            });

            const data = await response.json();

            if (response.ok) {
                setEmail(emailValue);
                setStep("otp");
                setSuccess("A verification code has been sent to your email.");
            } else {
                setError(data.error || "Failed to send OTP");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const formData = new FormData(e.currentTarget);
            const otpValue = formData.get("otp") as string;

            const response = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp: otpValue }),
            });

            const data = await response.json();

            if (response.ok) {
                setResetToken(data.resetToken);
                setStep("password");
                setSuccess("Code verified! Set your new password.");
            } else {
                setError(data.error || "Invalid OTP");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const formData = new FormData(e.currentTarget);
            const newPassword = formData.get("password") as string;
            const confirmPassword = formData.get("confirmPassword") as string;

            if (newPassword !== confirmPassword) {
                setError("Passwords do not match");
                setIsLoading(false);
                return;
            }

            if (newPassword.length < 8) {
                setError("Password must be at least 8 characters");
                setIsLoading(false);
                return;
            }

            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resetToken, newPassword }),
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess("Password reset successfully! Redirecting to login...");
                setTimeout(() => navigate("/"), 2000);
            } else {
                setError(data.error || "Failed to reset password");
            }
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const stepConfig = {
        email: {
            title: "Forgot password?",
            description: "No worries, we'll send you a verification code.",
        },
        otp: {
            title: "Check your email",
            description: `We sent a 6-digit code to ${email}`,
        },
        password: {
            title: "Set new password",
            description: "Your new password must be at least 8 characters.",
        },
    };

    return (
        <section className="min-h-screen overflow-hidden bg-secondary px-4 py-12 md:px-8 md:pt-24">
            <div className="mx-auto flex w-full flex-col gap-8 sm:max-w-110">
                <div className="flex flex-col items-center gap-6 text-center">
                    <div className="relative">
                        <BackgroundPattern pattern="grid" className="absolute top-1/2 left-1/2 z-0 hidden -translate-x-1/2 -translate-y-1/2 md:block" />
                        <BackgroundPattern pattern="grid" size="md" className="absolute top-1/2 left-1/2 z-0 -translate-x-1/2 -translate-y-1/2 md:hidden" />
                        <UntitledLogoMinimal className="relative z-10 size-12 max-md:hidden" />
                        <UntitledLogoMinimal className="relative z-10 size-10 md:hidden" />
                    </div>
                    <div className="z-10 flex flex-col gap-2 md:gap-3">
                        <h1 className="text-display-xs font-semibold text-primary md:text-display-sm">{stepConfig[step].title}</h1>
                        <p className="text-md text-tertiary">{stepConfig[step].description}</p>
                    </div>
                </div>

                {error && (
                    <div className="z-10 -mx-4 rounded-lg bg-red-50 px-4 py-3 text-red-800 sm:mx-0">
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {success && (
                    <div className="z-10 -mx-4 rounded-lg bg-green-50 px-4 py-3 text-green-800 sm:mx-0">
                        <p className="text-sm">{success}</p>
                    </div>
                )}

                {step === "email" && (
                    <Form
                        onSubmit={handleSendOtp}
                        className="z-10 -mx-4 flex flex-col gap-6 bg-primary px-4 py-8 sm:mx-0 sm:rounded-2xl sm:px-8 sm:shadow-sm"
                    >
                        <Input isRequired hideRequiredIndicator label="Email" type="email" name="email" placeholder="Enter your email" size="md" />
                        <div className="flex flex-col gap-4">
                            <Button type="submit" size="lg" disabled={isLoading}>
                                {isLoading ? "Sending..." : "Send verification code"}
                            </Button>
                        </div>
                    </Form>
                )}

                {step === "otp" && (
                    <Form
                        onSubmit={handleVerifyOtp}
                        className="z-10 -mx-4 flex flex-col gap-6 bg-primary px-4 py-8 sm:mx-0 sm:rounded-2xl sm:px-8 sm:shadow-sm"
                    >
                        <Input
                            isRequired
                            hideRequiredIndicator
                            label="Verification code"
                            type="text"
                            name="otp"
                            placeholder="Enter 6-digit code"
                            size="md"
                            maxLength={6}
                        />
                        <div className="flex flex-col gap-4">
                            <Button type="submit" size="lg" disabled={isLoading}>
                                {isLoading ? "Verifying..." : "Verify code"}
                            </Button>
                            <Button
                                type="button"
                                color="link-color"
                                size="md"
                                onClick={() => {
                                    setStep("email");
                                    setError(null);
                                    setSuccess(null);
                                }}
                            >
                                Didn't receive the code? Resend
                            </Button>
                        </div>
                    </Form>
                )}

                {step === "password" && (
                    <Form
                        onSubmit={handleResetPassword}
                        className="z-10 -mx-4 flex flex-col gap-6 bg-primary px-4 py-8 sm:mx-0 sm:rounded-2xl sm:px-8 sm:shadow-sm"
                    >
                        <div className="flex flex-col gap-5">
                            <Input isRequired hideRequiredIndicator label="New password" type="password" name="password" size="md" placeholder="••••••••" />
                            <Input isRequired hideRequiredIndicator label="Confirm password" type="password" name="confirmPassword" size="md" placeholder="••••••••" />
                        </div>
                        <div className="flex flex-col gap-4">
                            <Button type="submit" size="lg" disabled={isLoading}>
                                {isLoading ? "Resetting..." : "Reset password"}
                            </Button>
                        </div>
                    </Form>
                )}

                <div className="flex justify-center gap-1 text-center">
                    <Button color="link-color" size="md" href="/">
                        ← Back to log in
                    </Button>
                </div>
            </div>
        </section>
    );
};
