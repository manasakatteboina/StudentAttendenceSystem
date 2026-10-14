
document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const message = document.getElementById("message");
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const username = document.getElementById("username").value;
        const password = document.getElementById("password").value;
        if (username === "faculty" && password === "1234") {
            window.location.href = "dashboard.html";
        } else {
            message.textContent = "Invalid username or password.";
            message.style.color = "red";
        }
    });
});
