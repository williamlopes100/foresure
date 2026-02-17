import { useEffect, useState } from "react";

export const FadeAnimation = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger fade in after component mounts
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 50);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div 
            className={`fixed inset-0 z-50 bg-primary transition-opacity duration-500 ease-in-out ${
                isVisible ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
        >
            <div className="flex h-full items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 size-8 animate-spin rounded-full border-2 border-transparent border-t-brand"></div>
                    <p className="text-sm text-tertiary">Loading...</p>
                </div>
            </div>
        </div>
    );
};
