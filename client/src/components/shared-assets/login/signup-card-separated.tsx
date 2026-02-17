import { useState } from "react";
import { Button } from "@/components/base/buttons/button";
import { SocialButton } from "@/components/base/buttons/social-button";
import { Form } from "@/components/base/form/form";
import { Input } from "@/components/base/input/input";
import { UntitledLogoMinimal } from "@/components/foundations/logo/untitledui-logo-minimal";
import { BackgroundPattern } from "@/components/shared-assets/background-patterns";
import { useNavigate } from "react-router";

interface RegisterResponse {
    message: string;
    user: {
        id: number;
        email: string;
        firstName: string | null;
        lastName: string | null;
        createdAt: string;
    };
    token: string;
    error?: string;
}

export const SignupCardSeparated = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData(e.currentTarget);
            const firstName = formData.get("firstName") as string;
            const lastName = formData.get("lastName") as string;
            const email = formData.get("email") as string;
            const password = formData.get("password") as string;
            const confirmPassword = formData.get("confirmPassword") as string;

            if (password !== confirmPassword) {
                setError("Passwords do not match");
                setIsLoading(false);
                return;
            }

            if (password.length < 8) {
                setError("Password must be at least 8 characters");
                setIsLoading(false);
                return;
            }

            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email, password, firstName, lastName }),
            });

            const data: RegisterResponse = await response.json();

            if (response.ok) {
                localStorage.setItem("authToken", data.token);
                localStorage.setItem("user", JSON.stringify(data.user));
                navigate("/dashboard");
            } else {
                setError(data.error || "Registration failed");
            }
        } catch (err) {
            setError("Network error. Please try again.");
            console.error("Signup error:", err);
        } finally {
            setIsLoading(false);
        }
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
                        <h1 className="text-display-xs font-semibold text-primary md:text-display-sm">Create an account</h1>
                        <p className="text-md text-tertiary">Start automating your foreclosure workflow.</p>
                    </div>
                </div>

                <div className="flex justify-center gap-1 text-center md:hidden">
                    <span className="text-sm text-tertiary">Already have an account?</span>
                    <Button color="link-color" size="md" href="/">
                        Log in
                    </Button>
                </div>

                {error && (
                    <div className="z-10 -mx-4 rounded-lg bg-red-50 px-4 py-3 text-red-800 sm:mx-0">
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                <Form
                    onSubmit={handleSignup}
                    className="z-10 -mx-4 flex flex-col gap-6 bg-primary px-4 py-8 sm:mx-0 sm:rounded-2xl sm:px-8 sm:shadow-sm"
                >
                    <div className="flex flex-col gap-5">
                        <div className="flex gap-4">
                            <Input isRequired hideRequiredIndicator label="First name" type="text" name="firstName" placeholder="First name" size="md" />
                            <Input isRequired hideRequiredIndicator label="Last name" type="text" name="lastName" placeholder="Last name" size="md" />
                        </div>
                        <Input isRequired hideRequiredIndicator label="Email" type="email" name="email" placeholder="Enter your email" size="md" />
                        <Input isRequired hideRequiredIndicator label="Password" type="password" name="password" placeholder="Create a password" size="md" />
                        <Input isRequired hideRequiredIndicator label="Confirm password" type="password" name="confirmPassword" placeholder="Confirm your password" size="md" />
                    </div>

                    <div className="flex flex-col gap-4">
                        <Button type="submit" size="lg" disabled={isLoading}>
                            {isLoading ? "Creating account..." : "Get started"}
                        </Button>
                        <SocialButton social="google" theme="color">
                            Sign up with Google
                        </SocialButton>
                    </div>
                </Form>

                <div className="hidden justify-center gap-1 text-center md:flex">
                    <span className="text-sm text-tertiary">Already have an account?</span>
                    <Button color="link-color" size="md" href="/">
                        Log in
                    </Button>
                </div>
            </div>
        </section>
    );
};
