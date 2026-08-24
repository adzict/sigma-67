const messages = [
  "Hi.",
  "I am.",
  "Sigma.",
  "Sigma 67.",
  "And you are?",
  "Are you really Sigma? Really?"
];

const messageElement = document.getElementById("message");

let currentIndex = 0;

function changeMessage() {
  // Fade current text out
  messageElement.classList.add("fade-out");

  setTimeout(() => {
    // Change the text while invisible
    currentIndex = (currentIndex + 1) % messages.length;
    messageElement.textContent = messages[currentIndex];

    // Fade new text in
    messageElement.classList.remove("fade-out");
  }, 1200);
}

// Change every 4 seconds
setInterval(changeMessage, 4000);
