document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements - Generate Tab
    const uploadArea = document.getElementById("upload-area")
    const uploadPlaceholder = document.getElementById("upload-placeholder")
    const imagePreview = document.getElementById("image-preview")
    const clearImageBtn = document.getElementById("clear-image")
    const fileUpload = document.getElementById("file-upload")
    const generateButton = document.getElementById("generate-button")
    const captionContent = document.getElementById("caption-content")
    const actionButtons = document.getElementById("action-buttons")
    const likeButton = document.getElementById("like-button")
    const dislikeButton = document.getElementById("dislike-button")
    const copyButton = document.getElementById("copy-button")
    const feedbackForm = document.getElementById("feedback-form")
    const feedbackComment = document.getElementById("feedback-comment")
    const submitFeedback = document.getElementById("submit-feedback")
  
    // DOM Elements - Train Tab
    const trainUploadArea = document.getElementById("train-upload-area")
    const trainUploadPlaceholder = document.getElementById("train-upload-placeholder")
    const trainImagePreview = document.getElementById("train-image-preview")
    const trainClearImageBtn = document.getElementById("train-clear-image")
    const trainFileUpload = document.getElementById("train-file-upload")
    const trainingCaption = document.getElementById("training-caption")
    const saveTrainingBtn = document.getElementById("save-training")
  
    // DOM Elements - Tabs
    const tabButtons = document.querySelectorAll(".tab-button")
    const tabContents = document.querySelectorAll(".tab-content")
  
    // DOM Elements - Toast
    const toast = document.getElementById("toast")
    const toastIcon = document.getElementById("toast-icon")
    const toastTitle = document.getElementById("toast-title")
    const toastDescription = document.getElementById("toast-description")
  
    // Variables
    let currentCaption = null
    let feedbackLiked = null
    let currentFile = null
    let trainFile = null
    let toastTimeout = null
  
    // Tab Switching
    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        // Remove active class from all buttons and contents
        tabButtons.forEach((btn) => btn.classList.remove("active"))
        tabContents.forEach((content) => content.classList.remove("active"))
  
        // Add active class to clicked button and corresponding content
        button.classList.add("active")
        const tabId = button.getAttribute("data-tab")
        document.getElementById(`${tabId}-tab`).classList.add("active")
      })
    })
  
    // Image Upload - Generate Tab
    uploadArea.addEventListener("click", () => {
      if (!imagePreview.classList.contains("hidden")) return
      fileUpload.click()
    })
  
    fileUpload.addEventListener("change", handleFileSelect)
  
    function handleFileSelect(event) {
      const file = event.target.files[0]
      if (!file) return
  
      currentFile = file
      const reader = new FileReader()
  
      reader.onload = (e) => {
        imagePreview.src = e.target.result
        uploadPlaceholder.classList.add("hidden")
        imagePreview.classList.remove("hidden")
        clearImageBtn.classList.remove("hidden")
        generateButton.disabled = false
      }
  
      reader.readAsDataURL(file)
    }
  
    clearImageBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      resetImageUpload()
    })
  
    function resetImageUpload() {
      imagePreview.src = ""
      uploadPlaceholder.classList.remove("hidden")
      imagePreview.classList.add("hidden")
      clearImageBtn.classList.add("hidden")
      fileUpload.value = ""
      currentFile = null
      generateButton.disabled = true
  
      // Reset caption area
      captionContent.innerHTML = '<p class="placeholder-text">Generated caption will appear here</p>'
      actionButtons.classList.add("hidden")
      feedbackForm.classList.add("hidden")
      currentCaption = null
    }
  
    // Drag and Drop - Generate Tab
    uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault()
      uploadArea.classList.add("dragover")
    })
  
    uploadArea.addEventListener("dragleave", () => {
      uploadArea.classList.remove("dragover")
    })
  
    uploadArea.addEventListener("drop", (e) => {
      e.preventDefault()
      uploadArea.classList.remove("dragover")
  
      if (e.dataTransfer.files.length) {
        fileUpload.files = e.dataTransfer.files
        handleFileSelect({ target: { files: e.dataTransfer.files } })
      }
    })
  
    // Generate Caption
    generateButton.addEventListener("click", async () => {
      if (!currentFile) {
        showToast("error", "Error", "Please select an image first")
        return
      }
  
      // Show loading state
      generateButton.disabled = true
      generateButton.innerHTML = '<div class="spinner"></div> Generating...'
      captionContent.innerHTML =
        '<p class="placeholder-text">Generating detailed caption...<br>This may take a moment for high-quality results.</p>'
  
      const formData = new FormData()
      formData.append("file", currentFile)
  
      try {
        const response = await fetch("/api/generate-caption", {
          method: "POST",
          body: formData,
        })
  
        const data = await response.json()
  
        if (data.caption) {
          currentCaption = data.caption
  
          // Format the caption with paragraphs for better readability
          const formattedCaption = data.caption
            .split(/\n\n|\n/)
            .filter((para) => para.trim().length > 0)
            .map((para) => `<p>${para}</p>`)
            .join("")
  
          captionContent.innerHTML = formattedCaption || `<p>${data.caption}</p>`
          actionButtons.classList.remove("hidden")
  
          // Show success toast for better UX
          showToast("success", "Success!", "Caption generated successfully")
        } else {
          captionContent.innerHTML = `<p class="placeholder-text">Error: ${data.error || "Failed to generate caption"}</p>`
          showToast("error", "Error", data.error || "Failed to generate caption")
        }
      } catch (error) {
        captionContent.innerHTML = '<p class="placeholder-text">Error: An error occurred while processing the image</p>'
        showToast("error", "Error", "An error occurred while processing the image")
      } finally {
        generateButton.disabled = false
        generateButton.innerHTML = '<i class="fas fa-magic"></i> Generate Caption'
      }
    })
  
    // Caption Actions
    likeButton.addEventListener("click", () => {
      feedbackLiked = true
      feedbackForm.classList.remove("hidden")
    })
  
    dislikeButton.addEventListener("click", () => {
      feedbackLiked = false
      feedbackForm.classList.remove("hidden")
    })
  
    copyButton.addEventListener("click", () => {
      if (!currentCaption) return
  
      navigator.clipboard
        .writeText(currentCaption)
        .then(() => {
          showToast("success", "Copied!", "Caption copied to clipboard")
        })
        .catch(() => {
          showToast("error", "Error", "Failed to copy caption")
        })
    })
  
    // Submit Feedback
    submitFeedback.addEventListener("click", async () => {
      if (currentCaption === null || feedbackLiked === null) return
  
      const comment = feedbackComment.value
  
      try {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            caption: currentCaption,
            liked: feedbackLiked,
            comment: comment,
          }),
        })
  
        const data = await response.json()
  
        if (data.success) {
          showToast("success", "Thank you!", "Your feedback has been submitted")
          feedbackForm.classList.add("hidden")
          feedbackComment.value = ""
        } else {
          showToast("error", "Error", "Failed to submit feedback")
        }
      } catch (error) {
        showToast("error", "Error", "An error occurred while submitting feedback")
      }
    })
  
    // Image Upload - Train Tab
    trainUploadArea.addEventListener("click", () => {
      if (!trainImagePreview.classList.contains("hidden")) return
      trainFileUpload.click()
    })
  
    trainFileUpload.addEventListener("change", handleTrainFileSelect)
  
    function handleTrainFileSelect(event) {
      const file = event.target.files[0]
      if (!file) return
  
      trainFile = file
      const reader = new FileReader()
  
      reader.onload = (e) => {
        trainImagePreview.src = e.target.result
        trainUploadPlaceholder.classList.add("hidden")
        trainImagePreview.classList.remove("hidden")
        trainClearImageBtn.classList.remove("hidden")
        updateSaveButtonState()
      }
  
      reader.readAsDataURL(file)
    }
  
    trainClearImageBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      resetTrainImageUpload()
    })
  
    function resetTrainImageUpload() {
      trainImagePreview.src = ""
      trainUploadPlaceholder.classList.remove("hidden")
      trainImagePreview.classList.add("hidden")
      trainClearImageBtn.classList.add("hidden")
      trainFileUpload.value = ""
      trainFile = null
      updateSaveButtonState()
    }
  
    // Drag and Drop - Train Tab
    trainUploadArea.addEventListener("dragover", (e) => {
      e.preventDefault()
      trainUploadArea.classList.add("dragover")
    })
  
    trainUploadArea.addEventListener("dragleave", () => {
      trainUploadArea.classList.remove("dragover")
    })
  
    trainUploadArea.addEventListener("drop", (e) => {
      e.preventDefault()
      trainUploadArea.classList.remove("dragover")
  
      if (e.dataTransfer.files.length) {
        trainFileUpload.files = e.dataTransfer.files
        handleTrainFileSelect({ target: { files: e.dataTransfer.files } })
      }
    })
  
    // Training Caption Input
    trainingCaption.addEventListener("input", updateSaveButtonState)
  
    function updateSaveButtonState() {
      saveTrainingBtn.disabled = !trainFile || !trainingCaption.value.trim()
    }
  
    // Save Training Data
    saveTrainingBtn.addEventListener("click", async () => {
      if (!trainFile || !trainingCaption.value.trim()) {
        showToast("error", "Error", "Please select an image and provide a caption")
        return
      }
  
      // Show loading state
      saveTrainingBtn.disabled = true
      saveTrainingBtn.innerHTML = '<div class="spinner"></div> Saving...'
  
      const formData = new FormData()
      formData.append("file", trainFile)
      formData.append("caption", trainingCaption.value)
  
      try {
        const response = await fetch("/api/train", {
          method: "POST",
          body: formData,
        })
  
        const data = await response.json()
  
        if (data.success) {
          showToast("success", "Success!", "Training data has been saved successfully")
          resetTrainImageUpload()
          trainingCaption.value = ""
        } else {
          showToast("error", "Error", data.error || "Failed to save training data")
        }
      } catch (error) {
        showToast("error", "Error", "An error occurred while saving training data")
      } finally {
        saveTrainingBtn.disabled = false
        saveTrainingBtn.innerHTML = '<i class="fas fa-save"></i> Save Training Data'
      }
    })
  
    // Toast Notification
    function showToast(type, title, description) {
      // Clear any existing timeout
      if (toastTimeout) {
        clearTimeout(toastTimeout)
      }
  
      // Set icon based on type
      if (type === "success") {
        toastIcon.className = "fas fa-check-circle"
      } else if (type === "error") {
        toastIcon.className = "fas fa-exclamation-circle"
      } else {
        toastIcon.className = "fas fa-info-circle"
      }
  
      // Set content
      toastTitle.textContent = title
      toastDescription.textContent = description
  
      // Show toast
      toast.classList.remove("hidden")
  
      // Create progress bar
      const progressBar = document.createElement("div")
      progressBar.className = "toast-progress"
      toast.appendChild(progressBar)
  
      // Hide toast after 3 seconds
      toastTimeout = setTimeout(() => {
        toast.classList.add("hidden")
        if (toast.contains(progressBar)) {
          toast.removeChild(progressBar)
        }
      }, 3000)
    }
  })  