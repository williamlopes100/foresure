import { LogOut01 } from "@untitledui/icons";
import { Plus } from "@untitledui/icons";
import { EmptyState } from "@/components/application/empty-state/empty-state";
import { Button } from "@/components/base/buttons/button";
import { HeaderNavigationBase } from "@/components/application/app-navigation/header-navigation";
import { useAuth } from "@/hooks/useAuth";

export const DashboardPage = () => {
    const { user, logout } = useAuth();

    // Navigation items (empty for now)
    const navItems: any[] = [];

    return (
        <div className="min-h-screen bg-secondary">
            {/* Header Navigation */}
            <HeaderNavigationBase 
                activeUrl="/dashboard"
                items={navItems}
                showAvatarDropdown={true}
                hideBorder={false}
                showSettingsButton={false}
                showNotificationsButton={false}
            />

            {/* Main Content */}
            <main className="flex min-h-[calc(100vh-8rem)] items-start justify-center px-4 py-12 md:px-8 md:pt-24">
                <div className="w-full max-w-2xl mt-8">
                    <EmptyState size="md">
                        <EmptyState.Header>
                            <EmptyState.FeaturedIcon color="gray" />
                        </EmptyState.Header>

                        <EmptyState.Content>
                            <EmptyState.Title>Welcome back{user?.firstName ? `, ${user.firstName}` : ''}!</EmptyState.Title>
                            <EmptyState.Description>
                                You've successfully logged into your account. Your dashboard is ready to use.
                            </EmptyState.Description>
                        </EmptyState.Content>

                        <EmptyState.Footer>
                            <Button size="md" color="secondary" onClick={logout} iconLeading={LogOut01}>
                                Logout
                            </Button>
                            <Button size="md" iconLeading={Plus} onClick={() => window.location.href = '/foreclosure-form'}>
                                Start Foreclosure
                            </Button>
                        </EmptyState.Footer>
                    </EmptyState>
                </div>
            </main>
        </div>
    );
};
