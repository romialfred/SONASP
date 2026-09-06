import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "../../src/i18n/config";
import "../../src/index.css";
import { Login } from "../../src/pages/Login";

// Même composant et mêmes styles ; seule la réponse d’authentification est isolée.
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Login />
  </BrowserRouter>,
);
