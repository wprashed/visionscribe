document.addEventListener("DOMContentLoaded", () => {
  const uploadArea = document.getElementById("upload-area")
  const uploadPlaceholder = document.getElementById("upload-placeholder")
  const imagePreview = document.getElementById("image-preview")
  const clearImageBtn = document.getElementById("clear-image")
  const fileUpload = document.getElementById("file-upload")
  const generateButton = document.getElementById("generate-button")
  const captionEditor = document.getElementById("caption-editor")
  const metadataPanel = document.getElementById("metadata-panel")
  const actionButtons = document.getElementById("action-buttons")
  const saveCaptionButton = document.getElementById("save-caption-button")
  const likeButton = document.getElementById("like-button")
  const dislikeButton = document.getElementById("dislike-button")
  const copyButton = document.getElementById("copy-button")
  const feedbackForm = document.getElementById("feedback-form")
  const feedbackComment = document.getElementById("feedback-comment")
  const submitFeedback = document.getElementById("submit-feedback")
  const styleOptions = document.querySelectorAll(".style-option")
  const detailLevel = document.getElementById("detail-level")
  const audienceInput = document.getElementById("audience-input")
  const languageInput = document.getElementById("language-input")
  const variantCount = document.getElementById("variant-count")
  const variantsPanel = document.getElementById("variants-panel")
  const variantsGrid = document.getElementById("variants-grid")
  const batchFileUpload = document.getElementById("batch-file-upload")
  const batchSelectedList = document.getElementById("batch-selected-list")
  const batchCount = document.getElementById("batch-count")
  const batchStyleOptions = document.querySelectorAll("[data-batch-style]")
  const batchDetailLevel = document.getElementById("batch-detail-level")
  const batchLanguage = document.getElementById("batch-language")
  const batchAudience = document.getElementById("batch-audience")
  const batchGenerateButton = document.getElementById("batch-generate-button")
  const batchResults = document.getElementById("batch-results")
  const historySearch = document.getElementById("history-search")
  const historyStyleFilter = document.getElementById("history-style-filter")
  const historyGrid = document.getElementById("history-grid")
  const clearHistoryButton = document.getElementById("clear-history-button")
  const statsGrid = document.getElementById("stats-grid")
  const feedbackFeed = document.getElementById("feedback-feed")

  const trainUploadArea = document.getElementById("train-upload-area")
  const trainUploadPlaceholder = document.getElementById("train-upload-placeholder")
  const trainImagePreview = document.getElementById("train-image-preview")
  const trainClearImageBtn = document.getElementById("train-clear-image")
  const trainFileUpload = document.getElementById("train-file-upload")
  const trainingCaption = document.getElementById("training-caption")
  const saveTrainingBtn = document.getElementById("save-training")

  const tabButtons = document.querySelectorAll(".tab-button")
  const tabContents = document.querySelectorAll(".tab-content")
  const toast = document.getElementById("toast")
  const toastIcon = document.getElementById("toast-icon")
  const toastTitle = document.getElementById("toast-title")
  const toastDescription = document.getElementById("toast-description")

  let currentFile = null
  let currentCaption = null
  let currentCaptionId = null
  let feedbackLiked = null
  let selectedStyle = "detailed"
  let selectedBatchStyle = "detailed"
  let trainFile = null
  let toastTimeout = null

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tabButtons.forEach((btn) => btn.classList.remove("active"))
      tabContents.forEach((content) => content.classList.remove("active"))
      button.classList.add("active")
      document.getElementById(`${button.dataset.tab}-tab`).classList.add("active")

      if (button.dataset.tab === "history") loadHistory()
      if (button.dataset.tab === "dashboard") loadDashboard()
    })
  })

  styleOptions.forEach((button) => {
    button.addEventListener("click", () => {
      styleOptions.forEach((option) => option.classList.remove("active"))
      button.classList.add("active")
      selectedStyle = button.dataset.style
    })
  })

  batchStyleOptions.forEach((button) => {
    button.addEventListener("click", () => {
      batchStyleOptions.forEach((option) => option.classList.remove("active"))
      button.classList.add("active")
      selectedBatchStyle = button.dataset.batchStyle
    })
  })

  uploadArea.addEventListener("click", () => {
    if (!imagePreview.classList.contains("hidden")) return
    fileUpload.click()
  })
  fileUpload.addEventListener("change", (event) => handleFileSelect(event.target.files[0]))
  clearImageBtn.addEventListener("click", (event) => {
    event.stopPropagation()
    resetImageUpload()
  })

  uploadArea.addEventListener("dragover", (event) => {
    event.preventDefault()
    uploadArea.classList.add("dragover")
  })
  uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("dragover"))
  uploadArea.addEventListener("drop", (event) => {
    event.preventDefault()
    uploadArea.classList.remove("dragover")
    handleFileSelect(event.dataTransfer.files[0])
  })

  function handleFileSelect(file) {
    if (!file) return
    currentFile = file
    const reader = new FileReader()
    reader.onload = (event) => {
      imagePreview.src = event.target.result
      uploadPlaceholder.classList.add("hidden")
      imagePreview.classList.remove("hidden")
      clearImageBtn.classList.remove("hidden")
      generateButton.disabled = false
      renderMetadata({
        original_filename: file.name,
        file_size: file.size,
        image_format: file.type.replace("image/", "").toUpperCase(),
      })
    }
    reader.readAsDataURL(file)
  }

  function resetImageUpload() {
    imagePreview.src = ""
    uploadPlaceholder.classList.remove("hidden")
    imagePreview.classList.add("hidden")
    clearImageBtn.classList.add("hidden")
    fileUpload.value = ""
    currentFile = null
    currentCaption = null
    currentCaptionId = null
    feedbackLiked = null
    generateButton.disabled = true
    captionEditor.value = ""
    metadataPanel.innerHTML = "<span>No image selected</span>"
    actionButtons.classList.add("hidden")
    feedbackForm.classList.add("hidden")
    variantsPanel.classList.add("hidden")
    likeButton.classList.remove("active")
    dislikeButton.classList.remove("active")
  }

  generateButton.addEventListener("click", async () => {
    if (!currentFile) {
      showToast("error", "Missing image", "Please select an image first")
      return
    }

    setBusy(generateButton, "Generating...")
    captionEditor.value = "Generating caption..."
    variantsPanel.classList.add("hidden")

    const formData = new FormData()
    formData.append("file", currentFile)
    formData.append("style", selectedStyle)
    formData.append("detail_level", detailLevel.value)
    formData.append("audience", audienceInput.value)
    formData.append("language", languageInput.value)
    formData.append("variants", variantCount.value)

    try {
      const response = await fetch("/api/generate-caption", { method: "POST", body: formData })
      const data = await response.json()
      if (!data.caption) throw new Error(data.error || "Failed to generate caption")

      currentCaption = data.caption
      currentCaptionId = data.id
      captionEditor.value = data.caption
      actionButtons.classList.remove("hidden")
      renderMetadata(data.metadata)
      renderVariants(data.variants || [data.caption])
      showToast("success", "Caption ready", "Variants, metadata, and history were updated")
      loadDashboard(false)
    } catch (error) {
      captionEditor.value = ""
      showToast("error", "Generation failed", error.message)
    } finally {
      resetBusy(generateButton, '<i class="fas fa-magic"></i> Generate Caption')
    }
  })

  function renderVariants(variants) {
    variantsGrid.innerHTML = ""
    variants.forEach((caption, index) => {
      const card = document.createElement("button")
      card.className = "variant-card"
      card.innerHTML = `<span>Variant ${index + 1}</span><p>${escapeHtml(caption)}</p>`
      card.addEventListener("click", () => {
        captionEditor.value = caption
        currentCaption = caption
        showToast("success", "Variant selected", "The editable caption has been updated")
      })
      variantsGrid.appendChild(card)
    })
    variantsPanel.classList.toggle("hidden", variants.length === 0)
  }

  saveCaptionButton.addEventListener("click", async () => {
    if (!currentCaptionId || !captionEditor.value.trim()) return
    setBusy(saveCaptionButton, "Saving...")
    try {
      const response = await fetch(`/api/captions/${currentCaptionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption: captionEditor.value.trim() }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to save caption")
      currentCaption = data.caption
      showToast("success", "Saved", "Caption edit saved to history")
    } catch (error) {
      showToast("error", "Save failed", error.message)
    } finally {
      resetBusy(saveCaptionButton, '<i class="fas fa-floppy-disk"></i> Save Edit')
    }
  })

  likeButton.addEventListener("click", () => {
    feedbackLiked = true
    likeButton.classList.add("active")
    dislikeButton.classList.remove("active")
    feedbackForm.classList.remove("hidden")
  })

  dislikeButton.addEventListener("click", () => {
    feedbackLiked = false
    dislikeButton.classList.add("active")
    likeButton.classList.remove("active")
    feedbackForm.classList.remove("hidden")
  })

  copyButton.addEventListener("click", () => {
    const caption = captionEditor.value.trim()
    if (!caption) return
    navigator.clipboard.writeText(caption)
      .then(() => showToast("success", "Copied", "Caption copied to clipboard"))
      .catch(() => showToast("error", "Copy failed", "Clipboard access was unavailable"))
  })

  submitFeedback.addEventListener("click", async () => {
    const caption = captionEditor.value.trim()
    if (!caption || feedbackLiked === null) return

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, liked: feedbackLiked, comment: feedbackComment.value }),
      })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to submit feedback")
      showToast("success", "Feedback saved", "Thanks for improving the caption loop")
      feedbackForm.classList.add("hidden")
      feedbackComment.value = ""
      loadDashboard(false)
    } catch (error) {
      showToast("error", "Feedback failed", error.message)
    }
  })

  batchGenerateButton.addEventListener("click", async () => {
    const files = [...batchFileUpload.files].slice(0, 8)
    if (!files.length) {
      showToast("error", "Missing images", "Choose one or more batch images")
      return
    }

    setBusy(batchGenerateButton, "Generating batch...")
    batchResults.innerHTML = '<p class="placeholder-text">Generating batch captions...</p>'
    const formData = new FormData()
    files.forEach((file) => formData.append("files", file))
    formData.append("style", selectedBatchStyle)
    formData.append("detail_level", batchDetailLevel.value)
    formData.append("audience", batchAudience.value)
    formData.append("language", batchLanguage.value)

    try {
      const response = await fetch("/api/batch-generate", { method: "POST", body: formData })
      const data = await response.json()
      if (!data.results) throw new Error(data.error || "Batch generation failed")
      batchResults.innerHTML = data.results.map(renderBatchItem).join("")
      showToast("success", "Batch complete", `${data.results.length} captions generated`)
    } catch (error) {
      batchResults.innerHTML = '<p class="placeholder-text">Batch generation failed.</p>'
      showToast("error", "Batch failed", error.message)
    } finally {
      resetBusy(batchGenerateButton, '<i class="fas fa-layer-group"></i> Generate Batch')
    }
  })

  batchFileUpload.addEventListener("change", renderBatchSelection)
  batchResults.addEventListener("click", handleBatchResultAction)

  function renderBatchSelection() {
    const files = [...batchFileUpload.files].slice(0, 8)
    batchCount.textContent = files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "No files selected"

    if (!files.length) {
      batchSelectedList.innerHTML = '<p class="placeholder-text compact">Selected images will appear here.</p>'
      return
    }

    batchSelectedList.innerHTML = files.map((file, index) => `
      <article class="selected-file">
        <span>${index + 1}</span>
        <div>
          <strong>${escapeHtml(file.name)}</strong>
          <small>${Math.round(file.size / 1024)} KB</small>
        </div>
      </article>
    `).join("")
  }

  async function handleBatchResultAction(event) {
    const button = event.target.closest("[data-batch-action]")
    if (!button) return

    const item = button.closest(".batch-item")
    const textarea = item.querySelector(".batch-caption-editor")
    const caption = textarea.value.trim()
    const action = button.dataset.batchAction
    const captionId = button.dataset.captionId

    if (!caption) {
      showToast("error", "Missing caption", "There is no caption text to use")
      return
    }

    if (action === "copy") {
      navigator.clipboard.writeText(caption)
        .then(() => showToast("success", "Copied", "Batch caption copied"))
        .catch(() => showToast("error", "Copy failed", "Clipboard access was unavailable"))
      return
    }

    if (action === "save") {
      if (!captionId) return
      setBusy(button, "Saving...")
      try {
        const response = await fetch(`/api/captions/${captionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption }),
        })
        const data = await response.json()
        if (!data.success) throw new Error(data.error || "Failed to save caption")
        showToast("success", "Saved", "Batch caption edit saved")
      } catch (error) {
        showToast("error", "Save failed", error.message)
      } finally {
        resetBusy(button, '<i class="fas fa-floppy-disk"></i> Save')
      }
      return
    }

    if (action === "like" || action === "dislike") {
      const liked = action === "like"
      try {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caption, liked, comment: "Batch result feedback" }),
        })
        const data = await response.json()
        if (!data.success) throw new Error(data.error || "Failed to save feedback")
        item.querySelectorAll("[data-batch-action='like'], [data-batch-action='dislike']").forEach((actionButton) => {
          actionButton.classList.remove("active")
        })
        button.classList.add("active")
        showToast("success", "Feedback saved", liked ? "Marked as liked" : "Marked as needs work")
        loadDashboard(false)
      } catch (error) {
        showToast("error", "Feedback failed", error.message)
      }
    }
  }

  historySearch.addEventListener("input", debounce(loadHistory, 250))
  historyStyleFilter.addEventListener("change", loadHistory)
  clearHistoryButton.addEventListener("click", clearHistory)
  historyGrid.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("[data-delete-caption]")
    if (!deleteButton) return
    deleteHistoryItem(deleteButton.dataset.deleteCaption)
  })

  async function loadHistory() {
    const params = new URLSearchParams({
      query: historySearch.value,
      style: historyStyleFilter.value,
    })
    const response = await fetch(`/api/history?${params}`)
    const data = await response.json()
    if (!data.items.length) {
      historyGrid.innerHTML = '<p class="placeholder-text">No captions found yet.</p>'
      return
    }
    historyGrid.innerHTML = data.items.map(renderHistoryItem).join("")
  }

  async function deleteHistoryItem(captionId) {
    if (!captionId) return
    const confirmed = window.confirm("Delete this caption from history?")
    if (!confirmed) return

    try {
      const response = await fetch(`/api/captions/${captionId}`, { method: "DELETE" })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Could not delete caption")
      showToast("success", "Deleted", "Caption removed from history")
      loadHistory()
      loadDashboard(false)
    } catch (error) {
      showToast("error", "Delete failed", error.message)
    }
  }

  async function clearHistory() {
    const confirmed = window.confirm("Delete all caption history? This cannot be undone.")
    if (!confirmed) return

    setBusy(clearHistoryButton, "Clearing...")
    try {
      const response = await fetch("/api/history", { method: "DELETE" })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Could not clear history")
      showToast("success", "History cleared", `${data.deleted || 0} captions removed`)
      loadHistory()
      loadDashboard(false)
    } catch (error) {
      showToast("error", "Clear failed", error.message)
    } finally {
      resetBusy(clearHistoryButton, '<i class="fas fa-trash"></i> Clear')
    }
  }

  async function loadDashboard(showErrors = true) {
    try {
      const response = await fetch("/api/dashboard")
      const data = await response.json()
      statsGrid.innerHTML = [
        ["Captions", data.stats.captions, "fa-closed-captioning"],
        ["Liked", data.stats.liked, "fa-thumbs-up"],
        ["Disliked", data.stats.disliked, "fa-thumbs-down"],
        ["Training pairs", data.stats.training, "fa-database"],
      ].map(([label, value, icon]) => `<div class="stat-card"><i class="fas ${icon}"></i><span>${label}</span><strong>${value}</strong></div>`).join("")

      feedbackFeed.innerHTML = data.feedback.length
        ? data.feedback.map((item) => `<article class="feedback-item"><strong>${item.liked ? "Liked" : "Needs work"}</strong><p>${escapeHtml(item.comment || item.caption)}</p><span>${formatDate(item.created_at)}</span></article>`).join("")
        : '<p class="placeholder-text">No feedback submitted yet.</p>'
    } catch (error) {
      if (showErrors) showToast("error", "Dashboard failed", error.message)
    }
  }

  trainUploadArea.addEventListener("click", () => {
    if (!trainImagePreview.classList.contains("hidden")) return
    trainFileUpload.click()
  })
  trainFileUpload.addEventListener("change", (event) => handleTrainFileSelect(event.target.files[0]))
  trainClearImageBtn.addEventListener("click", (event) => {
    event.stopPropagation()
    resetTrainImageUpload()
  })
  trainUploadArea.addEventListener("dragover", (event) => {
    event.preventDefault()
    trainUploadArea.classList.add("dragover")
  })
  trainUploadArea.addEventListener("dragleave", () => trainUploadArea.classList.remove("dragover"))
  trainUploadArea.addEventListener("drop", (event) => {
    event.preventDefault()
    trainUploadArea.classList.remove("dragover")
    handleTrainFileSelect(event.dataTransfer.files[0])
  })
  trainingCaption.addEventListener("input", updateSaveButtonState)

  function handleTrainFileSelect(file) {
    if (!file) return
    trainFile = file
    const reader = new FileReader()
    reader.onload = (event) => {
      trainImagePreview.src = event.target.result
      trainUploadPlaceholder.classList.add("hidden")
      trainImagePreview.classList.remove("hidden")
      trainClearImageBtn.classList.remove("hidden")
      updateSaveButtonState()
    }
    reader.readAsDataURL(file)
  }

  function resetTrainImageUpload() {
    trainImagePreview.src = ""
    trainUploadPlaceholder.classList.remove("hidden")
    trainImagePreview.classList.add("hidden")
    trainClearImageBtn.classList.add("hidden")
    trainFileUpload.value = ""
    trainFile = null
    updateSaveButtonState()
  }

  function updateSaveButtonState() {
    saveTrainingBtn.disabled = !trainFile || !trainingCaption.value.trim()
  }

  saveTrainingBtn.addEventListener("click", async () => {
    if (!trainFile || !trainingCaption.value.trim()) return
    setBusy(saveTrainingBtn, "Saving...")
    const formData = new FormData()
    formData.append("file", trainFile)
    formData.append("caption", trainingCaption.value)

    try {
      const response = await fetch("/api/train", { method: "POST", body: formData })
      const data = await response.json()
      if (!data.success) throw new Error(data.error || "Failed to save training data")
      showToast("success", "Training saved", "The image-caption pair was stored")
      resetTrainImageUpload()
      trainingCaption.value = ""
      loadDashboard(false)
    } catch (error) {
      showToast("error", "Training failed", error.message)
    } finally {
      resetBusy(saveTrainingBtn, '<i class="fas fa-save"></i> Save Training Data')
    }
  })

  function renderMetadata(metadata) {
    if (!metadata) return
    const filename = metadata.original_filename || "Selected image"
    const size = metadata.file_size ? `${Math.round(metadata.file_size / 1024)} KB` : "Unknown size"
    const dimensions = metadata.width && metadata.height
      ? `${metadata.width} x ${metadata.height}`
      : metadata.image_width && metadata.image_height
        ? `${metadata.image_width} x ${metadata.image_height}`
        : "Dimensions pending"
    const format = metadata.format || metadata.image_format || "Image"
    metadataPanel.innerHTML = `
      <div><span>File</span><strong>${escapeHtml(filename)}</strong></div>
      <div><span>Size</span><strong>${size}</strong></div>
      <div><span>Dimensions</span><strong>${dimensions}</strong></div>
      <div><span>Format</span><strong>${escapeHtml(format)}</strong></div>
    `
  }

  function renderBatchItem(item) {
    return `
      <article class="batch-item">
        <img src="/${escapeHtml(item.metadata.path)}" alt="">
        <div class="batch-result-body">
          <strong>${escapeHtml(item.metadata.original_filename)}</strong>
          <textarea class="batch-caption-editor">${escapeHtml(item.caption)}</textarea>
          <div class="batch-actions">
            <button class="action-button save" type="button" data-batch-action="save" data-caption-id="${item.id}"><i class="fas fa-floppy-disk"></i> Save</button>
            <button class="action-button like" type="button" data-batch-action="like"><i class="fas fa-thumbs-up"></i> Like</button>
            <button class="action-button dislike" type="button" data-batch-action="dislike"><i class="fas fa-thumbs-down"></i> Dislike</button>
            <button class="action-button copy" type="button" data-batch-action="copy"><i class="fas fa-copy"></i> Copy</button>
          </div>
        </div>
      </article>
    `
  }

  function renderHistoryItem(item) {
    return `
      <article class="history-card">
        <img src="${escapeHtml(item.image_url)}" alt="">
        <div>
          <div class="history-meta">
            <span>${escapeHtml(item.style || "detailed")}</span>
            <button class="icon-button danger" type="button" data-delete-caption="${item.id}" title="Delete caption"><i class="fas fa-trash"></i></button>
          </div>
          <strong>${escapeHtml(item.original_filename || "Uploaded image")}</strong>
          <span class="history-date">${formatDate(item.created_at)}</span>
          <p>${escapeHtml(item.caption)}</p>
        </div>
      </article>
    `
  }

  function setBusy(button, label) {
    button.disabled = true
    button.dataset.original = button.innerHTML
    button.innerHTML = `<div class="spinner"></div> ${label}`
  }

  function resetBusy(button, fallback) {
    button.disabled = false
    button.innerHTML = button.dataset.original || fallback
  }

  function showToast(type, title, description) {
    if (toastTimeout) clearTimeout(toastTimeout)
    toastIcon.className = type === "success"
      ? "fas fa-check-circle"
      : type === "error"
        ? "fas fa-exclamation-circle"
        : "fas fa-info-circle"
    toastTitle.textContent = title
    toastDescription.textContent = description
    toast.classList.remove("hidden")
    toastTimeout = setTimeout(() => toast.classList.add("hidden"), 3000)
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  function formatDate(value) {
    if (!value) return ""
    const date = new Date(String(value).replace(" ", "T"))
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
  }

  function debounce(fn, delay) {
    let timeout
    return () => {
      clearTimeout(timeout)
      timeout = setTimeout(fn, delay)
    }
  }

  loadDashboard(false)
})
