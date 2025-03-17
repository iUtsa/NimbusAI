document.addEventListener("DOMContentLoaded", function() {
    // DOM Elements
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const messagesContainer = document.getElementById("messages");
    const clearChatBtn = document.getElementById("clear-chat");
    const shareChatBtn = document.getElementById("share-chat");
    const newChatBtn = document.getElementById("new-chat-btn");
    const conversationList = document.getElementById("conversation-list");
    const toggleThemeBtn = document.getElementById("toggle-theme");
    const modelSelect = document.getElementById("model");
    
    // For mobile responsiveness
    const sidebar = document.querySelector(".sidebar");
    const sidebarHeader = document.querySelector(".sidebar-header");
    
    // Current conversation ID
    let currentConversationId = null;
    let messageHistory = [];
    
    // Initialize the app
    init();
    
    // Functions
    async function init() {
        adjustTextareaHeight();
        setupEventListeners();
        
        // Create a new conversation by default
        await createNewConversation();
        
        // Load existing conversations from localStorage
        loadConversations();
        
        // Set up suggestion chips
        setupSuggestionChips();
    }
    
    function setupEventListeners() {
        // Form submission
        chatForm.addEventListener("submit", handleSubmit);
        
        // Auto-resize textarea
        userInput.addEventListener("input", adjustTextareaHeight);
        
        // Button actions
        clearChatBtn.addEventListener("click", clearChat);
        shareChatBtn.addEventListener("click", shareChat);
        newChatBtn.addEventListener("click", createNewConversation);
        toggleThemeBtn.addEventListener("click", toggleTheme);
        
        // Mobile sidebar toggle
        if (window.innerWidth <= 768) {
            sidebarHeader.addEventListener("click", toggleSidebar);
        }
        
        // Model selection
        modelSelect.addEventListener("change", saveModelPreference);
        
        // Load saved theme preference
        loadThemePreference();
    }
    
    async function handleSubmit(e) {
        e.preventDefault();
        const message = userInput.value.trim();
        
        if (!message) return;
        
        // Add user message to UI
        addMessageToUI("user", message);
        
        // Clear input
        userInput.value = "";
        adjustTextareaHeight();
        
        // Save to history
        messageHistory.push({ role: "user", content: message });
        saveConversation();
        
        // Show typing indicator
        showTypingIndicator();
        
        try {
            // Get AI response
            const response = await getAIResponse(message);
            
            // Remove typing indicator
            removeTypingIndicator();
            
            // Add AI response to UI
            addMessageToUI("ai", response);
            
            // Save to history
            messageHistory.push({ role: "assistant", content: response });
            saveConversation();
            
            // Update conversation title if it's the first message
            if (messageHistory.length === 2) {
                updateConversationTitle(message);
            }
            
            // Scroll to bottom
            scrollToBottom();
        } catch (error) {
            console.error("Error getting AI response:", error);
            removeTypingIndicator();
            addMessageToUI("ai", "Sorry, I encountered an error. Please try again.");
        }
    }
    
    async function getAIResponse(message) {
        const conversationId = "default"; // Change if multiple conversations are needed.
    
        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message, conversation_id: conversationId })
            });
    
            const data = await response.json();
    
            if (data.status === "success") {
                return data.response;  // Return the actual API response
            } else {
                return "Error: Unable to generate response.";
            }
        } catch (error) {
            console.error("Error fetching AI response:", error);
            return "Error connecting to server.";
        }
    }
    
    
    function addMessageToUI(sender, content) {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${sender}-message`;
    
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
        // Format message with markdown
        const formattedContent = formatMessage(content);
    
        // If the sender is AI, add a copy button
        messageDiv.innerHTML = `
            <div class="message-header">
                ${
                    sender === "ai"
                        ? '<div class="nimbus-logo"></div>'
                        : '<div class="avatar user-avatar">U</div>'
                }
                <span class="message-sender">${sender === "user" ? "You" : "Nimbus"}</span>
                <span class="message-time">${timestamp}</span>
            </div>
            <div class="message-content">${formattedContent}</div>
            ${
                sender === "ai"
                    ? `<button class="copy-response-btn" data-message="${escapeHTML(content)}">
                         <i class="fas fa-copy"></i> Copy
                       </button>`
                    : ""
            }
        `;
    
        // Append message
        messagesContainer.appendChild(messageDiv);
        scrollToBottom();
    
        // If AI response, add copy functionality
        if (sender === "ai") {
            const copyBtn = messageDiv.querySelector(".copy-response-btn");
            copyBtn.addEventListener("click", function () {
                navigator.clipboard.writeText(content).then(() => {
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    setTimeout(() => {
                        copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                    }, 2000);
                });
            });
        }
    }
    
    
    function formatMessage(content) {
        // Basic markdown formatting
        // This is a simplified implementation; use a proper markdown library in production
        
        // Code blocks
        content = content.replace(/```([\s\S]*?)```/g, function(match, code) {
            return `<div class="code-wrapper"><pre><code>${escapeHTML(code)}</code></pre><button class="copy-btn">Copy</button></div>`;
        });
        
        // Inline code
        content = content.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Bold
        content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Italic
        content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Headers
        content = content.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        content = content.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        content = content.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Lists
        content = content.replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>');
        content = content.replace(/^\s*\-\s+(.*$)/gm, '<li>$1</li>');
        
        // Replace newlines with <br>
        content = content.replace(/\n/g, '<br>');
        
        return content;
    }
    
    function escapeHTML(html) {
        return html
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
    
    function addCopyButtonsToCodeBlocks() {
        const copyButtons = document.querySelectorAll('.copy-btn');
        copyButtons.forEach(button => {
            if (!button.hasListener) {
                button.addEventListener('click', function() {
                    const codeBlock = this.previousElementSibling;
                    const code = codeBlock.textContent;
                    
                    navigator.clipboard.writeText(code).then(() => {
                        this.textContent = "Copied!";
                        setTimeout(() => {
                            this.textContent = "Copy";
                        }, 2000);
                    });
                });
                button.hasListener = true;
            }
        });
    }
    
    function showTypingIndicator() {
        const typingDiv = document.createElement("div");
        typingDiv.className = "typing-indicator";
        typingDiv.id = "typing-indicator";
        typingDiv.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        messagesContainer.appendChild(typingDiv);
        scrollToBottom();
    }
    
    function removeTypingIndicator() {
        const typingIndicator = document.getElementById("typing-indicator");
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    function adjustTextareaHeight() {
        userInput.style.height = "auto";
        userInput.style.height = (userInput.scrollHeight) + "px";
    }
    
    async function createNewConversation() {
        // Generate a new conversation ID
        currentConversationId = generateId();
        
        // Clear message history
        messageHistory = [];
        
        // Clear messages container
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Nimbus Welcomes You!</h2>
                <p>Ask me anything! We will go beyond horizon together!</p>
                <div class="suggestion-chips">
                    <button class="suggestion-chip">Write a poem about nature</button>
                    <button class="suggestion-chip">Help me learn Python</button>
                    <button class="suggestion-chip">Explain quantum computing</button>
                    <button class="suggestion-chip">Plan a healthy meal</button>
                </div>
            </div>
        `;
        
        // Add to conversations list
        addConversationToList({
            id: currentConversationId,
            title: "New Conversation",
            timestamp: new Date().toISOString(),
            messages: []
        });
        
        // Set up suggestion chips
        setupSuggestionChips();
        
        // Save to localStorage
        saveConversationsList();
    }
    
    function setupSuggestionChips() {
        const chips = document.querySelectorAll(".suggestion-chip");
        chips.forEach(chip => {
            chip.addEventListener("click", function() {
                userInput.value = this.textContent;
                adjustTextareaHeight();
                chatForm.dispatchEvent(new Event("submit"));
            });
        });
    }
    
    function addConversationToList(conversation) {
        // Create conversation item
        const item = document.createElement("li");
        item.className = "chat-item";
        item.dataset.id = conversation.id;
        item.innerHTML = `
            <i class="fas fa-comment"></i>
            <span>${conversation.title}</span>
            <button class="delete-chat-btn"><i class="fas fa-times"></i></button>
        `;
        
        // Add click event to load conversation
        item.addEventListener("click", function(e) {
            if (!e.target.closest(".delete-chat-btn")) {
                loadConversation(conversation.id);
            }
        });
        
        // Add delete button functionality
        const deleteBtn = item.querySelector(".delete-chat-btn");
        deleteBtn.addEventListener("click", function(e) {
            e.stopPropagation();
            deleteConversation(conversation.id);
        });
        
        // Add to list
        conversationList.prepend(item);
        
        // Highlight current conversation
        updateActiveConversation();
    }
    
    function updateActiveConversation() {
        // Remove active class from all items
        document.querySelectorAll(".chat-item").forEach(item => {
            item.classList.remove("active");
        });
        
        // Add active class to current conversation
        const activeItem = document.querySelector(`.chat-item[data-id="${currentConversationId}"]`);
        if (activeItem) {
            activeItem.classList.add("active");
        }
    }
    
    function updateConversationTitle(message) {
        // Create a title from the first user message
        const title = message.length > 30 ? message.substring(0, 30) + "..." : message;
        
        // Update in the list
        const item = document.querySelector(`.chat-item[data-id="${currentConversationId}"] span`);
        if (item) {
            item.textContent = title;
        }
        
        // Update in localStorage
        updateConversationData({ title });
        
        // Save to localStorage
        saveConversationsList();
    }
    
    function loadConversation(id) {
        // Get conversation from localStorage
        const conversations = JSON.parse(localStorage.getItem("conversations") || "[]");
        const conversation = conversations.find(conv => conv.id === id);
        
        if (!conversation) return;
        
        // Set current conversation ID
        currentConversationId = id;
        
        // Clear messages container
        messagesContainer.innerHTML = "";
        
        // Set message history
        messageHistory = [...conversation.messages];
        
        // Rebuild UI from messages
        messageHistory.forEach(msg => {
            addMessageToUI(msg.role === "user" ? "user" : "ai", msg.content);
        });
        
        // If empty, show welcome message
        if (messageHistory.length === 0) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>Welcome to AI Assistant!</h2>
                    <p>Ask me anything and I'll do my best to help you.</p>
                    <div class="suggestion-chips">
                        <button class="suggestion-chip">Write a poem about nature</button>
                        <button class="suggestion-chip">Help me learn Python</button>
                        <button class="suggestion-chip">Explain quantum computing</button>
                        <button class="suggestion-chip">Plan a healthy meal</button>
                    </div>
                </div>
            `;
            setupSuggestionChips();
        }
        
        // Highlight current conversation
        updateActiveConversation();
    }
    
    function deleteConversation(id) {
        // Remove from UI
        const item = document.querySelector(`.chat-item[data-id="${id}"]`);
        if (item) {
            item.remove();
        }
        
        // Remove from localStorage
        const conversations = JSON.parse(localStorage.getItem("conversations") || "[]");
        const updatedConversations = conversations.filter(conv => conv.id !== id);
        localStorage.setItem("conversations", JSON.stringify(updatedConversations));
        
        // If current conversation was deleted, create a new one
        if (id === currentConversationId) {
            createNewConversation();
        }
    }
    
    function loadConversations() {
        // Get conversations from localStorage
        const conversations = JSON.parse(localStorage.getItem("conversations") || "[]");
        
        // Sort by timestamp (newest first)
        conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Add to list
        conversations.forEach(conversation => {
            addConversationToList(conversation);
        });
    }
    
    function saveConversation() {
        updateConversationData({ messages: messageHistory });
        saveConversationsList();
    }
    
    function updateConversationData(updateData) {
        // Get conversations from localStorage
        const conversations = JSON.parse(localStorage.getItem("conversations") || "[]");
        
        // Find current conversation
        const index = conversations.findIndex(conv => conv.id === currentConversationId);
        
        if (index !== -1) {
            // Update conversation data
            conversations[index] = { ...conversations[index], ...updateData, timestamp: new Date().toISOString() };
        } else {
            // Create new conversation
            conversations.push({
                id: currentConversationId,
                title: "New Conversation",
                timestamp: new Date().toISOString(),
                messages: messageHistory,
                ...updateData
            });
        }
        
        // Save to localStorage
        localStorage.setItem("conversations", JSON.stringify(conversations));
    }
    
    function saveConversationsList() {
        // Get conversations from localStorage
        const conversations = JSON.parse(localStorage.getItem("conversations") || "[]");
        
        // Only keep the 20 most recent conversations
        const recentConversations = conversations
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 20);
        
        // Save to localStorage
        localStorage.setItem("conversations", JSON.stringify(recentConversations));
    }
    
    function clearChat() {
        if (confirm("Are you sure you want to clear this conversation?")) {
            // Clear message history
            messageHistory = [];
            
            // Clear messages container
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h2>Welcome to AI Assistant!</h2>
                    <p>Ask me anything and I'll do my best to help you.</p>
                    <div class="suggestion-chips">
                        <button class="suggestion-chip">Write a poem about nature</button>
                        <button class="suggestion-chip">Help me learn Python</button>
                        <button class="suggestion-chip">Explain quantum computing</button>
                        <button class="suggestion-chip">Plan a healthy meal</button>
                    </div>
                </div>
            `;
            
            // Set up suggestion chips
            setupSuggestionChips();
            
            // Update in localStorage
            updateConversationData({ messages: [] });
        }
    }
    
    function shareChat() {
        if (messageHistory.length === 0) {
            alert("There's nothing to share yet. Start a conversation first!");
            return;
        }
        
        // Prepare conversation text
        let conversationText = "# Conversation with AI Assistant\n\n";
        
        messageHistory.forEach(msg => {
            const role = msg.role === "user" ? "You" : "AI Assistant";
            conversationText += `**${role}**: ${msg.content}\n\n`;
        });
        
        // Create a blob and generate a download link
        const blob = new Blob([conversationText], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        
        // Create download link
        const a = document.createElement("a");
        a.href = url;
        a.download = `conversation-${new Date().toISOString().slice(0, 10)}.md`;
        document.body.appendChild(a);
        a.click();
        
        // Clean up
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    function toggleTheme() {
        document.body.classList.toggle("dark-mode");
        
        // Update button text
        const icon = toggleThemeBtn.querySelector("i");
        const text = toggleThemeBtn.querySelector("span");
        
        if (document.body.classList.contains("dark-mode")) {
            icon.className = "fas fa-sun";
            text.textContent = "Light Mode";
            localStorage.setItem("theme", "dark");
        } else {
            icon.className = "fas fa-moon";
            text.textContent = "Dark Mode";
            localStorage.setItem("theme", "light");
        }
    }
    
    function loadThemePreference() {
        const theme = localStorage.getItem("theme");
        
        if (theme === "dark") {
            document.body.classList.add("dark-mode");
            const icon = toggleThemeBtn.querySelector("i");
            const text = toggleThemeBtn.querySelector("span");
            icon.className = "fas fa-sun";
            text.textContent = "Light Mode";
        }
    }
    
    function saveModelPreference() {
        localStorage.setItem("model", modelSelect.value);
    }
    
    function toggleSidebar() {
        sidebar.classList.toggle("expanded");
    }
    
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
});



//smaller screen menu toggle from side
document.addEventListener("DOMContentLoaded", function () {
    const sidebar = document.querySelector(".sidebar");
    const menuToggle = document.getElementById("menu-toggle");
    const mainContent = document.querySelector(".main-content");

    // Toggle sidebar when clicking menu button
    menuToggle.addEventListener("click", function (event) {
        sidebar.classList.toggle("expanded");
        event.stopPropagation(); // Prevent event bubbling
    });

    // Close sidebar when clicking outside of it
    document.addEventListener("click", function (event) {
        if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
            sidebar.classList.remove("expanded");
        }
    });

    // Prevent clicks inside the sidebar from closing it
    sidebar.addEventListener("click", function (event) {
        event.stopPropagation();
    });
});

