import { useState } from "react";

export const useAuth = () => {
    // Check auth immediately and synchronously
    const checkAuthSync = () => {
        const token = localStorage.getItem('authToken');
        const userData = localStorage.getItem('user');
        
        if (token && userData) {
            try {
                const parsedUser = JSON.parse(userData);
                return { isAuthenticated: true, user: parsedUser };
            } catch (error) {
                // Invalid user data, clear storage
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                return { isAuthenticated: false, user: null };
            }
        } else {
            return { isAuthenticated: false, user: null };
        }
    };

    const [authState, setAuthState] = useState(checkAuthSync);

    const logout = () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        setAuthState({ isAuthenticated: false, user: null });
    };

    return { 
        isAuthenticated: authState.isAuthenticated, 
        user: authState.user, 
        loading: false, // Always false since we check synchronously
        logout 
    };
};
