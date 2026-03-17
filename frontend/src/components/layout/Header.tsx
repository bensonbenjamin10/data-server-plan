import { UserButton } from "@clerk/clerk-react";
import { OrganizationSwitcher } from "@clerk/clerk-react";

export function Header() {
  return (
    <header className="h-14 border-b border-neutral/60 bg-surface flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">
        <OrganizationSwitcher
          afterCreateOrganizationUrl="/files"
          afterSelectOrganizationUrl="/files"
          appearance={{
            elements: {
              rootBox: "flex items-center",
            },
            variables: {
              colorPrimary: "#2c3e50",
              colorBackground: "#f5f5f0",
              borderRadius: "8px",
            },
          }}
        />
      </div>
      <nav className="flex items-center gap-4">
        <UserButton
          afterSignOutUrl="/sign-in"
          appearance={{
            variables: {
              colorPrimary: "#2c3e50",
              colorBackground: "#f5f5f0",
            },
          }}
        />
      </nav>
    </header>
  );
}
