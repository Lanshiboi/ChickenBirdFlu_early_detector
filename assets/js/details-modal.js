class DetailsModal {
    constructor() {
        this.createModal();
        this.setupEventListeners();
    }

    createModal() {
        // Create modal HTML if it doesn't exist
        if (!document.getElementById('detailsModal')) {
            const modalHTML = `
                <div class="modal fade" id="detailsModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Analysis Details</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="text-center mb-4">
                                    <div class="row">
                                        <div class="col-md-6">
                                            <h6>Analyzed Image</h6>
                                            <img id="modalImage" src="" alt="Analysis" class="img-fluid rounded" style="max-height: 300px;">
                                        </div>
                                        <div class="col-md-6">
                                            <h6>Heat Pattern</h6>
                                            <img id="modalHeatPattern" src="" alt="Heat Pattern" class="img-fluid rounded" style="max-height: 300px; display: none;">
                                        </div>
                                    </div>
                                </div>

                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="fw-bold">Date & Time:</label>
                                            <p id="modalDate" class="mb-1"></p>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="fw-bold">Status:</label>
                                            <div id="modalStatus"></div>
                                        </div>
                                    </div>
                                </div>

                                <div class="mb-3">
                                    <h6>Observed Signs</h6>
                                    <ul id="modalObservedSigns" class="list-unstyled"></ul>
                                </div>
                                <div class="mb-3">
                                    <h6>Interpretation</h6>
                                    <div id="modalInterpretation"></div>
                                </div>
                                <div class="mb-3">
                                    <h6>Recommended Actions</h6>
                                    <ul id="modalRecommendedActions" class="list-unstyled"></ul>
                                </div>

                                <div class="mb-3">
                                    <label class="fw-bold">Notes:</label>
                                    <textarea id="modalNotes" class="form-control" rows="3"></textarea>
                                </div>
                            </div>

                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" id="modalSave">Save Changes</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHTML);
        }

        this.modal = new bootstrap.Modal(document.getElementById('detailsModal'));
        this.modalElement = document.getElementById('detailsModal');
    }

    setupEventListeners() {
        const saveBtn = document.getElementById('modalSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveChanges());
        }
    }

    show(data) {
        this.currentData = data;
        this.updateModalContent(data);
        this.modal.show();
    }

    updateModalContent(data) {
        const treatmentRecommendations = {
            'healthy': 'No treatment needed.',
            'infected': 'Immediate treatment required. Refer to laboratory for analysis.',
            'birdflu': 'Immediate isolation required. Contact veterinarian urgently.'
        };

        // Handle image and optional bounding boxes
        if (data.parts_data && Array.isArray(data.parts_data)) {
            const modalImageContainer = document.getElementById('modalImage').parentElement;
            const existingCanvas = modalImageContainer.querySelector('canvas');
            if (existingCanvas) existingCanvas.remove();

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = function () {
                const modalImg = document.getElementById('modalImage');
                const displayWidth = modalImg.clientWidth;
                const displayHeight = modalImg.clientHeight;

                canvas.width = displayWidth;
                canvas.height = displayHeight;

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

                const scaleX = displayWidth / img.naturalWidth;
                const scaleY = displayHeight / img.naturalHeight;

                data.parts_data.forEach(chicken => {
                    chicken.parts.forEach(part => {
                        let [x1, y1, x2, y2] = part.bbox;
                        x1 *= scaleX; y1 *= scaleY;
                        x2 *= scaleX; y2 *= scaleY;

                        const label = part.type || "Part";
                        const colorMap = { head: 'lime', legs: 'orange', body: 'cyan' };
                        const color = colorMap[label.toLowerCase()] || 'red';

                        ctx.strokeStyle = color;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                        ctx.fillStyle = color;
                        ctx.font = 'bold 14px Arial';
                        ctx.fillText(label, x1 + 4, y1 + 16);
                    });
                });

                modalImg.style.display = 'none';
                modalImageContainer.appendChild(canvas);
            };
            img.src = data.image;
        } else {
            const modalImg = document.getElementById('modalImage');
            modalImg.style.display = 'block';
            modalImg.src = data.image;
            const modalImageContainer = modalImg.parentElement;
            const existingCanvas = modalImageContainer.querySelector('canvas');
            if (existingCanvas) existingCanvas.remove();
        }

        // Handle heat pattern display
        const modalHeatPattern = document.getElementById('modalHeatPattern');
        const heatPatternSrc = data.heatPattern || data.heatPatternImage || '';

        if (heatPatternSrc) {
            modalHeatPattern.src = heatPatternSrc;
            modalHeatPattern.style.display = 'block';
        } else {
            modalHeatPattern.style.display = 'none';
        }

        document.getElementById('modalDate').textContent = data.date;

        // Update status badge
        const statusBadge = this.createStatusBadge(data.status);
        document.getElementById('modalStatus').innerHTML = statusBadge;

        // Parse details into sections
        const detailsArray = Array.isArray(data.details) ? data.details : [];
        const interpIndex = detailsArray.findIndex(d => d.startsWith('Interpretation:'));

        let observedSigns, interpretation, recommendedActions;
        if (interpIndex !== -1) {
            observedSigns = detailsArray.slice(0, interpIndex);
            interpretation = detailsArray[interpIndex].replace('Interpretation: ', '');
            recommendedActions = detailsArray.slice(interpIndex + 1);
        } else {
            // Fallback: divide equally
            const len = detailsArray.length;
            observedSigns = detailsArray.slice(0, Math.floor(len / 3));
            interpretation = detailsArray.slice(Math.floor(len / 3), Math.floor(2 * len / 3)).join(' ');
            recommendedActions = detailsArray.slice(Math.floor(2 * len / 3));
        }

        // Populate Observed Signs
        const observedSignsList = document.getElementById('modalObservedSigns');
        const isHealthy = data.status.toLowerCase() === 'healthy';
        const observedHtml = observedSigns.map(sign => {
            const iconClass = `bi-thermometer-half ${isHealthy ? 'text-primary' : 'text-danger'}`;
            return `<li><i class="bi ${iconClass} me-2"></i>${sign}</li>`;
        }).join('');
        observedSignsList.innerHTML = observedHtml;
        observedSignsList.style.listStyle = 'none';
        observedSignsList.style.paddingLeft = '0px';
        observedSignsList.style.marginLeft = '0px';

        // Populate Interpretation
        const interpretationDiv = document.getElementById('modalInterpretation');
        interpretationDiv.innerHTML = interpretation ? `<p>${interpretation}</p>` : '<p>No interpretation available.</p>';

        // Populate Recommended Actions
        const actionsList = document.getElementById('modalRecommendedActions');
        const actionsHtml = recommendedActions.map(action => {
            const iconClass = isHealthy ? 'bi-check-circle text-primary' : 'bi-exclamation-triangle text-danger';
            return `<li><i class="bi ${iconClass} me-2"></i>${action}</li>`;
        }).join('');
        actionsList.innerHTML = actionsHtml;
        actionsList.style.listStyle = 'none';
        actionsList.style.paddingLeft = '0px';
        actionsList.style.marginLeft = '0px';

        // Notes
        document.getElementById('modalNotes').value = data.notes || '';
    }

    saveChanges() {
        const notes = document.getElementById('modalNotes').value;
        this.currentData.notes = notes;
        this.currentData.lastModified = new Date().toISOString();

        const analyses = JSON.parse(localStorage.getItem('analyses') || '[]');
        const index = analyses.findIndex(a => a.id === this.currentData.id);
        if (index !== -1) {
            analyses[index] = this.currentData;
            localStorage.setItem('analyses', JSON.stringify(analyses));
        }

        document.dispatchEvent(new CustomEvent('analysisUpdated', {
            detail: this.currentData
        }));

        this.modal.hide();
    }

    createStatusBadge(status) {
        const className = this.getStatusClass(status);
        return `<span class="badge ${className}">${status}</span>`;
    }

    getStatusClass(status) {
        switch (status.toLowerCase()) {
            case 'healthy': return 'bg-success';
            case 'infected':
            case 'birdflu': return 'bg-danger';
            case 'detection failed': return 'bg-warning';
            default: return 'bg-secondary';
        }
    }
}

// Initialize globally
window.DetailsModal = DetailsModal;

function viewDetails(analysisId) {
    const analyses = JSON.parse(localStorage.getItem('analyses') || '[]');
    const analysis = analyses.find(a => a.id === analysisId);

    if (!analysis) {
        alert('Analysis not found');
        return;
    }

    if (!window.detailsModalInstance) {
        window.detailsModalInstance = new DetailsModal();
    }

    window.detailsModalInstance.show(analysis);
}
