export function hostReturnPath(value: string | null | undefined) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) {
        return "/host";
    }

    return value.startsWith("/host") ? value : "/host";
}