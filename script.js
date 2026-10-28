
document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const message = document.getElementById("message");
    const showPassword = document.getElementById("showPassword");
    const passwordInput = document.getElementById("password");
    const loginButton = document.getElementById("loginButton");

    // Show or hide the password
    showPassword.addEventListener("change", function () {
        passwordInput.type = this.checked ? "text" : "password";
    });

    // Handle faculty login
    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const username = document.getElementById("username").value.trim();
        const password = passwordInput.value;

        message.textContent = "";
        loginButton.disabled = true;
        loginButton.textContent = "Signing in...";

        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            });

            const result = await response.json();

            if (!response.ok) {
                message.textContent =
                    result.message || "Invalid username or password.";
                message.style.color = "red";
                return;
            }

            // Save the login token and faculty details
            localStorage.setItem("token", result.token);
            localStorage.setItem("facultyName", result.name);
            localStorage.setItem("facultyUsername", result.username);

            message.textContent = "Login successful!";
            message.style.color = "green";

            // Open the dashboard
            window.location.href = "dashboard.html";

        } catch (error) {
            console.error("Login error:", error);

            message.textContent =
                "Cannot connect to the server. Please try again.";
            message.style.color = "red";

        } finally {
            loginButton.disabled = false;
            loginButton.innerHTML =
                'Sign In <span aria-hidden="true">→</span>';
        }
    });
});
