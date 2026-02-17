import type { HTMLAttributes } from "react";
import { cx } from "@/utils/cx";

export const UntitledLogoMinimal = (props: HTMLAttributes<HTMLImageElement>) => {
    return (
        <img
            src="/foresure-logo.png"
            alt="ForeSure"
            {...props}
            className={cx("w-32 object-contain", props.className)}
        />
    );
};
