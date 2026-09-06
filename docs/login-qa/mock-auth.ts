export const useAuth = () => ({
  signIn: async () => ({
    error:
      new URLSearchParams(window.location.search).get("error") === "network"
        ? "Failed to fetch"
        : "Invalid login credentials",
  }),
});
