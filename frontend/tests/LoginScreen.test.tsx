import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginScreen } from "@/components/LoginScreen";
import { api, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  api: { login: vi.fn() },
}));

const login = vi.mocked(api.login);

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
}

describe("LoginScreen", () => {
  beforeEach(() => {
    login.mockReset();
    window.localStorage.clear();
  });

  it("asks for both fields before calling the API", () => {
    render(<LoginScreen onSignedIn={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert").textContent).toBe("Enter your email and password.");
    expect(login).not.toHaveBeenCalled();
  });

  it("stores the token and reports the user on success", async () => {
    login.mockResolvedValue({ access_token: "tok-123", user: { id: 1, email: "a@b.co" } });
    const onSignedIn = vi.fn();
    render(<LoginScreen onSignedIn={onSignedIn} />);
    fill("a@b.co", "pw");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith({ id: 1, email: "a@b.co" }));
    expect(login).toHaveBeenCalledWith("a@b.co", "pw");
    expect(getToken()).toBe("tok-123");
  });

  it("shows the server message and stays on the form when credentials are wrong", async () => {
    login.mockRejectedValue(new ApiError("Incorrect email or password", 401));
    const onSignedIn = vi.fn();
    render(<LoginScreen onSignedIn={onSignedIn} />);
    fill("a@b.co", "nope");
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Incorrect email or password");
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(getToken()).toBeNull();
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
