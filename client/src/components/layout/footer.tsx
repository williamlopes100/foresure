import { UntitledLogoMinimal } from "@/components/foundations/logo/untitledui-logo-minimal";

export const Footer = () => {
    return (
        <footer className="border-t border-secondary bg-primary px-4 py-8 md:px-8">
            <div className="mx-auto max-w-container">
                <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
                    {/* Logo and Copyright */}
                    <div className="flex flex-col gap-4">
                        <UntitledLogoMinimal className="size-8" />
                        <p className="text-sm text-tertiary">
                            © 2024 Untitled UI. All rights reserved.
                        </p>
                    </div>

                    {/* Links */}
                    <div className="flex flex-col gap-4 md:flex-row md:gap-8">
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-primary">Product</h3>
                            <ul className="flex flex-col gap-1">
                                <li><a href="#" className="text-sm text-tertiary hover:text-secondary">Features</a></li>
                                <li><a href="#" className="text-sm text-tertiary hover:text-secondary">Pricing</a></li>
                                <li><a href="#" className="text-sm text-tertiary hover:text-secondary">Documentation</a></li>
                            </ul>
                        </div>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-primary">Company</h3>
                            <ul className="flex flex-col gap-1">
                                <li><a href="#" className="text-sm text-tertiary hover:text-secondary">About</a></li>
                                <li><a href="#" className="text-sm text-tertiary hover:text-secondary">Blog</a></li>
                                <li><a href="#" className="text-sm text-tertiary hover:text-secondary">Careers</a></li>
                            </ul>
                        </div>
                        <div className="flex flex-col gap-2">
                            <h3 className="text-sm font-semibold text-primary">Support</h3>
                            <ul className="flex flex-col gap-1">
                                <li><a href="#" className="text-sm text-tertiary hover:text-secondary">Help Center</a></li>
                                <li><a href="#" className="text-sm text-tertiary hover:text-secondary">Contact</a></li>
                                <li><a href="#" className="text-sm text-tertiary hover:text-secondary">Status</a></li>
                            </ul>
                        </div>
                    </div>

                    {/* Social Links */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-semibold text-primary">Connect</h3>
                        <div className="flex gap-4">
                            <a href="#" className="text-sm text-tertiary hover:text-secondary">Twitter</a>
                            <a href="#" className="text-sm text-tertiary hover:text-secondary">GitHub</a>
                            <a href="#" className="text-sm text-tertiary hover:text-secondary">LinkedIn</a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
};
