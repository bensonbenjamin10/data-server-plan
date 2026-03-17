import { SignIn } from "@clerk/clerk-react";

export function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#2c3e50",
            colorBackground: "#f5f5f0",
            colorInputBackground: "#ffffff",
            colorInputText: "#1a252f",
            borderRadius: "10px",
          },
        }}
      />
    </div>
  );
}
