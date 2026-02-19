import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
    ArrowLeft,
    Mail01,
} from "@untitledui/icons";
import type { FileListItemProps } from "@/components/application/file-upload/file-upload-base";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { SectionFooter } from "@/components/application/section-footers/section-footer";
import { SectionHeader } from "@/components/application/section-headers/section-headers";
import { SectionLabel } from "@/components/application/section-headers/section-label";
import { TabList, Tabs } from "@/components/application/tabs/tabs";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Form } from "@/components/base/form/form";
import { InputBase, TextField } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { Select } from "@/components/base/select/select";
import { NativeSelect } from "@/components/base/select/select-native";
import { TextEditor } from "@/components/base/text-editor/text-editor";
import { countriesOptions } from "@/utils/countries";
import { timezonesOptionsWithLongName } from "@/utils/timezones";

const tabs = [
    { id: "details", label: "My details" },
    { id: "profile", label: "Profile" },
    { id: "password", label: "Password" },
];

const placeholderFiles: FileListItemProps[] = [
    {
        name: "Tech design requirements.pdf",
        type: "pdf",
        size: 200 * 1024,
        progress: 100,
    },
    {
        name: "Dashboard recording.mp4",
        type: "mp4",
        size: 1600 * 1024,
        progress: 40,
    },
    {
        name: "Dashboard prototype FINAL.fig",
        type: "fig",
        failed: false,
        size: 4200 * 1024,
        progress: 80,
    },
];

const PasswordTab = ({ email }: { email: string }) => {
    const [step, setStep] = useState<'request' | 'verify' | 'reset' | 'done'>('request');
    const [otp, setOtp] = useState('');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleSendOtp = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
            setSuccess(data.message);
            setStep('verify');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Invalid OTP');
            setResetToken(data.resetToken);
            setSuccess('OTP verified. Set your new password.');
            setStep('reset');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resetToken, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');
            setSuccess('Password updated successfully!');
            setStep('done');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 px-4 lg:px-8">
            <SectionHeader.Root>
                <SectionHeader.Group>
                    <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
                        <SectionHeader.Heading>Password</SectionHeader.Heading>
                        <SectionHeader.Subheading>Change your password via email verification.</SectionHeader.Subheading>
                    </div>
                </SectionHeader.Group>
            </SectionHeader.Root>

            {error && (
                <div className="rounded-lg bg-error-primary px-4 py-3 text-sm text-error-primary ring-1 ring-error-secondary">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-lg bg-success-primary px-4 py-3 text-sm text-success-primary ring-1 ring-success-secondary">
                    {success}
                </div>
            )}

            {step === 'request' && (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-secondary">
                        We'll send a 6-digit verification code to <span className="font-semibold text-primary">{email}</span> to verify your identity before allowing a password change.
                    </p>
                    <div>
                        <Button size="md" color="primary" isDisabled={loading} onClick={handleSendOtp}>
                            {loading ? 'Sending...' : 'Send Verification Code'}
                        </Button>
                    </div>
                </div>
            )}

            {step === 'verify' && (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-secondary">
                        Enter the 6-digit code sent to your email.
                    </p>
                    <div className="max-w-xs">
                        <label className="mb-1.5 block text-sm font-medium text-secondary">Verification Code</label>
                        <input
                            type="text"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                            placeholder="000000"
                            className="w-full rounded-lg border border-primary bg-primary px-3.5 py-2.5 text-center text-lg font-semibold tracking-[0.3em] text-primary shadow-xs outline-none placeholder:text-quaternary focus:border-brand-solid focus:ring-1 focus:ring-brand-solid"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Button size="md" color="primary" isDisabled={loading || otp.length !== 6} onClick={handleVerifyOtp}>
                            {loading ? 'Verifying...' : 'Verify Code'}
                        </Button>
                        <button onClick={handleSendOtp} className="text-sm font-medium text-brand-secondary hover:underline" disabled={loading}>
                            Resend code
                        </button>
                    </div>
                </div>
            )}

            {step === 'reset' && (
                <div className="flex flex-col gap-4">
                    <div className="flex max-w-sm flex-col gap-4">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-secondary">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Min. 8 characters"
                                className="w-full rounded-lg border border-primary bg-primary px-3.5 py-2.5 text-sm text-primary shadow-xs outline-none placeholder:text-quaternary focus:border-brand-solid focus:ring-1 focus:ring-brand-solid"
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-secondary">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Re-enter password"
                                className="w-full rounded-lg border border-primary bg-primary px-3.5 py-2.5 text-sm text-primary shadow-xs outline-none placeholder:text-quaternary focus:border-brand-solid focus:ring-1 focus:ring-brand-solid"
                            />
                        </div>
                    </div>
                    <div>
                        <Button size="md" color="primary" isDisabled={loading || !newPassword || !confirmPassword} onClick={handleResetPassword}>
                            {loading ? 'Updating...' : 'Update Password'}
                        </Button>
                    </div>
                </div>
            )}

            {step === 'done' && (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-success-primary font-medium">✓ Your password has been updated successfully.</p>
                    <div>
                        <Button size="md" color="secondary" onClick={() => { setStep('request'); setSuccess(null); setError(null); setOtp(''); setNewPassword(''); setConfirmPassword(''); }}>
                            Done
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export const Settings01 = () => {
    const { user } = useAuth();
    const [selectedTab, setSelectedTab] = useState<string>("details");
    const [uploadedAvatar, setUploadedAvatar] = useState<string | null>(null);

    const handleAvatarUpload = (file: File) => {
        console.log("File uploaded:", file);
        setUploadedAvatar(URL.createObjectURL(file));
    };

    return (
        <div className="bg-primary">
            <main className="mx-auto max-w-5xl px-4 pt-8 pb-12 lg:px-8">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col gap-5">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => window.history.back()}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-quaternary ring-1 ring-secondary ring-inset transition hover:bg-primary_hover hover:text-fg-quaternary_hover"
                            >
                                <ArrowLeft className="size-5" />
                            </button>
                            <h1 className="text-xl font-semibold text-primary lg:text-display-xs">Settings</h1>
                        </div>

                        <NativeSelect
                            aria-label="Page tabs"
                            className="md:hidden"
                            value={selectedTab}
                            onChange={(event) => setSelectedTab(event.target.value)}
                            options={tabs.map((tab) => ({ label: tab.label, value: tab.id }))}
                        />
                        <div className="-mx-4 -my-1 scrollbar-hide flex overflow-auto px-4 py-1 lg:-mx-8 lg:px-8">
                            <Tabs className="hidden md:flex xl:w-full" selectedKey={selectedTab} onSelectionChange={(value) => setSelectedTab(value as string)}>
                                <TabList type="underline" className="w-full" items={tabs} />
                            </Tabs>
                        </div>
                    </div>
                    {selectedTab === 'password' && (
                        <PasswordTab email={user?.email ?? ''} />
                    )}

                    {(selectedTab === 'details' || selectedTab === 'profile') && <Form
                        className="flex flex-col gap-6 px-4 lg:px-8"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const data = Object.fromEntries(new FormData(e.currentTarget));
                            console.log("Form data:", data);
                        }}
                    >
                        <SectionHeader.Root>
                            <SectionHeader.Group>
                                <div className="flex flex-1 flex-col justify-center gap-0.5 self-stretch">
                                    <SectionHeader.Heading>Personal info</SectionHeader.Heading>
                                    <SectionHeader.Subheading>Update your photo and personal details here.</SectionHeader.Subheading>
                                </div>

                                <SectionHeader.Actions>
                                    <Button color="secondary" size="md">
                                        Cancel
                                    </Button>
                                    <Button type="submit" color="primary" size="md">
                                        Save
                                    </Button>
                                </SectionHeader.Actions>
                            </SectionHeader.Group>
                        </SectionHeader.Root>

                        {/* Form content */}
                        <div className="flex flex-col gap-5">
                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root isRequired size="sm" title="Name" className="max-lg:hidden" />

                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
                                    <TextField isRequired name="firstName" defaultValue={user?.firstName ?? ''}>
                                        <Label className="lg:hidden">First name</Label>
                                        <InputBase size="md" />
                                    </TextField>
                                    <TextField isRequired name="lastName" defaultValue={user?.lastName ?? ''}>
                                        <Label className="lg:hidden">Last name</Label>
                                        <InputBase size="md" />
                                    </TextField>
                                </div>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root isRequired size="sm" title="Email address" className="max-lg:hidden" />

                                <TextField isRequired name="email" type="email" defaultValue={user?.email ?? ''}>
                                    <Label className="lg:hidden">Email address</Label>
                                    <InputBase size="md" icon={Mail01} />
                                </TextField>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root
                                    isRequired
                                    size="sm"
                                    title="Your photo"
                                    description="This will be displayed on your profile."
                                    tooltip="This is tooltip"
                                />
                                <div className="flex flex-col gap-5 lg:flex-row">
                                    <Avatar size="2xl" src={uploadedAvatar || "https://www.untitledui.com/images/avatars/olivia-rhye?fm=webp&q=80"} />

                                    <FileUpload.DropZone className="w-full" onDropFiles={(files) => handleAvatarUpload(files[0])} />
                                </div>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root size="sm" title="Role" className="max-lg:hidden" />

                                <TextField name="role" defaultValue="Product Designer">
                                    <Label className="lg:hidden">Role</Label>
                                    <InputBase size="md" />
                                </TextField>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root size="sm" title="Country" className="max-lg:hidden" />

                                <Select name="country" label="Country" size="md" defaultSelectedKey="AU" className="lg:label:hidden" items={countriesOptions}>
                                    {(item) => (
                                        <Select.Item id={item.id} icon={item.icon}>
                                            {item.label}
                                        </Select.Item>
                                    )}
                                </Select>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root size="sm" title="Timezone" tooltip="This is tooltip" className="max-lg:hidden" />

                                <Select
                                    name="timezone"
                                    label="Timezone"
                                    size="md"
                                    tooltip="This is a tooltip"
                                    className="lg:label:hidden"
                                    defaultSelectedKey={timezonesOptionsWithLongName.find((item) => item.label?.includes("PST"))?.id}
                                    items={timezonesOptionsWithLongName}
                                >
                                    {(item) => (
                                        <Select.Item id={item.id} avatarUrl={item.avatarUrl} supportingText={item.supportingText} icon={item.icon}>
                                            {item.label}
                                        </Select.Item>
                                    )}
                                </Select>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root isRequired size="sm" title="Bio" description="Write a short introduction." />

                                <TextEditor.Root
                                    limit={400}
                                    className="gap-2"
                                    inputClassName="min-h-70 p-4 resize-y"
                                    content="I'm a Product Designer based in Melbourne, Australia. I specialize in UX/UI design, brand strategy, and Webflow development."
                                >
                                    <TextEditor.Toolbar floating type="simple" />

                                    <div className="flex flex-col gap-1.5">
                                        <TextEditor.Content />
                                        <TextEditor.HintText />
                                    </div>
                                </TextEditor.Root>
                            </div>

                            <hr className="h-px w-full border-none bg-border-secondary" />

                            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(200px,280px)_minmax(400px,512px)] lg:gap-8">
                                <SectionLabel.Root size="sm" title="Portfolio projects" description="Share a few snippets of your work." />

                                <FileUpload.Root>
                                    <FileUpload.DropZone />

                                    <FileUpload.List>
                                        {placeholderFiles.map((file) => (
                                            <FileUpload.ListItemProgressBar key={file.name} {...file} size={file.size} />
                                        ))}
                                    </FileUpload.List>
                                </FileUpload.Root>
                            </div>
                        </div>

                        <SectionFooter.Root>
                            <SectionFooter.Actions>
                                <Button color="secondary" size="md">
                                    Cancel
                                </Button>
                                <Button type="submit" color="primary" size="md">
                                    Save
                                </Button>
                            </SectionFooter.Actions>
                        </SectionFooter.Root>
                    </Form>}
                </div>
            </main>
        </div>
    );
};
