
const API_URL = window.location.origin;

// Show/hide password
const showPassword = document.getElementById("showPassword");

if (showPassword) {
    showPassword.addEventListener("change", function () {
        document.getElementById("password").type =
            this.checked ? "text" : "password";
    });
}

// Faculty login
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const message = document.getElementById("message");
        const button = document.getElementById("loginButton");

        message.textContent = "";
        button.disabled = true;
        button.textContent = "Signing in...";

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Login failed.");
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("faculty", JSON.stringify(data.faculty));

            message.textContent = "Login successful! Redirecting...";
            message.style.color = "green";

            window.location.href = "dashboard.html";

        } catch (error) {
            console.error("Login error:", error);
            message.textContent = error.message || "Unable to connect to server.";
            message.style.color = "red";
        } finally {
            button.disabled = false;
            button.innerHTML = 'Sign In <span aria-hidden="true">→</span>';
        }
    });
}
