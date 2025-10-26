document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const imagePreview = document.getElementById('imagePreview');
    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const saveBtn = document.getElementById('saveBtn');
    const resultContainer = document.getElementById('resultContainer');
    const analyzedImage = document.getElementById('analyzedImage');
    const analysisDate = document.getElementById('analysisDate');
    const resultChickenId = document.getElementById('resultChickenId');
    const healthStatus = document.getElementById('healthStatus');
    const monitoringMessage = document.getElementById('monitoringMessage');
    const labTestMessage = document.getElementById('labTestMessage');
    const saveNotification = document.getElementById('saveNotification');
    const cancelBtn = document.getElementById('cancelBtn');

    let uploadedFile = null;

    // --- File Upload ---
    fileInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) {
            uploadedFile = e.target.files[0];

            // Size limit 40MB
            const maxSizeMB = 40;
            if (uploadedFile.size > maxSizeMB * 1024 * 1024) {
                alert(`File size exceeds ${maxSizeMB} MB limit.`);
                resetForm();
                return;
            }

            // Validate type
            const validTypes = ['image/jpeg', 'image/png', 'image/bmp', 'image/tiff'];
            if (!validTypes.includes(uploadedFile.type)) {
                alert('Invalid file type. Please upload a thermal chicken image.');
                resetForm();
                return;
            }

            const reader = new FileReader();
            reader.onload = function (e) {
                imagePreview.src = e.target.result;
                imagePreview.style.display = 'block';
                uploadPlaceholder.classList.add('hidden');
                analyzeBtn.style.display = 'block';
                analyzeBtn.disabled = false;
                cancelBtn.style.display = 'inline-block';

                resultContainer.style.display = 'none';
                saveBtn.style.display = 'none';
                if (monitoringMessage) monitoringMessage.style.display = 'none';
                if (labTestMessage) labTestMessage.style.display = 'none';
            };
            reader.readAsDataURL(uploadedFile);
        }
    });

    // --- Cancel Upload ---
    cancelBtn.addEventListener('click', resetForm);

    // --- Analyze Button ---
    analyzeBtn.addEventListener('click', function () {
        if (!uploadedFile) {
            alert("Please upload an image first.");
            return;
        }

        analyzeBtn.disabled = true;
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = 'flex';

        // Send image to Flask API using FormData for better handling of large files
        const formData = new FormData();
        formData.append('image', uploadedFile);

        fetch('/api/analyze', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            console.log('Debug: Received data from backend:', data); // Debug log for backend data

            // Ensure loading shows for at least 2 seconds to prevent flashing
            setTimeout(() => {
                if (data.error) {
                    alert('Error analyzing image: ' + data.error);
                    analyzeBtn.disabled = false;
                    loadingOverlay.style.display = 'none';
                    return;
                }

                // Remove Detection Failed from dashboard and report
                if (data.result === 'Detection Failed') {
                    alert('Detection failed. Please ensure the image is clear and contains a visible chicken, then try again.');
                    analyzeBtn.disabled = false;
                    loadingOverlay.style.display = 'none';
                    return;
                }

                const chickenId = generateChickenId();
                const originalStatus = data.result || 'Detection Failed';

                window.latestAnalysisData = data;
                window.originalStatus = originalStatus; // Store for save function

                populateResults(data, originalStatus, chickenId);

                analyzeBtn.disabled = false;
                loadingOverlay.style.display = 'none';
            }, 2000); // Minimum 2 second delay
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error analyzing image: ' + error.message);
            analyzeBtn.disabled = false;
            loadingOverlay.style.display = 'none';
        });
    });

    // Function to populate results (shared for backend and simulation)
    function populateResults(data, originalStatus, chickenId) {
        if (!originalStatus) originalStatus = data.result || 'Detection Failed';
        if (!chickenId) chickenId = generateChickenId();

        healthStatus.innerHTML = `<strong>${originalStatus}</strong>`;

        // --- Detection Count ---
        const detectionCountElem = document.getElementById('detectionCount');
        if (detectionCountElem) {
            detectionCountElem.style.display = 'none';
        }

        // --- Messages ---
        if (monitoringMessage) monitoringMessage.style.display = (originalStatus.includes('Healthy')) ? 'none' : 'block';
        if (labTestMessage) labTestMessage.style.display = 'none';

        const heatPatternImage = document.getElementById('heatPatternImage');
        heatPatternImage.src = data.heat_pattern_image || '';

        analyzedImage.src = data.image;
        resultContainer.style.display = 'block';
        analysisDate.textContent = new Date().toLocaleString();
        resultChickenId.textContent = chickenId;
        saveBtn.style.display = 'block';

        // --- Confidence Display ---
        const confidenceDisplay = document.getElementById('confidenceDisplay');
        if (confidenceDisplay) {
            confidenceDisplay.textContent = data.confidence !== undefined
                ? `${(data.confidence * 100).toFixed(1)}%`
                : 'N/A';
        }

        // --- Results Tab ---
        const resultObservedSignsList = document.getElementById('resultObservedSignsList');
        const resultInterpretationText = document.getElementById('resultInterpretationText');
        const resultRecommendedActionsList = document.getElementById('resultRecommendedActionsList');

        if (originalStatus === 'Healthy') {
            // Healthy specific content
            if (resultObservedSignsList) {
                let signsHtml = '';
                if (data.temperatures && typeof data.temperatures === 'object') {
                    const headTemp = (data.temperatures.head !== undefined && data.temperatures.head !== null) ? Number(data.temperatures.head).toFixed(2) : 'N/A';
                    const bodyMean = (data.temperatures.body !== undefined && data.temperatures.body !== null) ? Number(data.temperatures.body).toFixed(2) : 'N/A';
                    const headStatus = headTemp !== 'N/A' && parseFloat(headTemp) >= 40.0 && parseFloat(headTemp) <= 42.5 ? '✅ Within healthy range (40.0 – 42.5 °C)' : 'Outside healthy range';
                    const bodyStatus = bodyMean !== 'N/A' && parseFloat(bodyMean) >= 37.5 && parseFloat(bodyMean) <= 41.0 ? '✅ Stable average body heat (37.5 – 41.0 °C)' : 'Outside stable range';
                    const legTemp = (data.temperatures.leg !== undefined && data.temperatures.leg !== null && data.temperatures.leg !== 'N/A') ? Number(data.temperatures.leg).toFixed(2) : 'N/A';
                    const legStatus = legTemp !== 'N/A' && parseFloat(legTemp) >= 38.0 ? '✅ Normal leg temperature' : (legTemp === 'N/A' ? 'N/A' : 'Below normal');
                    signsHtml += `<li>Head Temperature: <strong>${headTemp} °C</strong>${headStatus ? ' — ' + headStatus : ''}</li>`;
                    signsHtml += `<li>Body Temperature: <strong>${bodyMean} °C</strong>${bodyStatus ? ' — ' + bodyStatus : ''}</li>`;
                    signsHtml += `<li>Leg Temperature: <strong>${legTemp === 'N/A' ? 'N/A' : legTemp + ' °C'}</strong>${legTemp !== 'N/A' ? ' — ' + legStatus : ''}</li>`;
                } else {
                    const avgTemp = data.average_temperature ? Number(data.average_temperature).toFixed(2) : 'N/A';
                    signsHtml += `<li>Head Temperature: <strong>${avgTemp} °C</strong> — ✅ Within healthy range (40.0 – 42.5 °C)</li>`;
                    signsHtml += `<li>Body Temperature: <strong>${avgTemp} °C</strong> — ✅ Stable average body heat (39.0 – 41.0 °C)</li>`;
                }
                resultObservedSignsList.innerHTML = signsHtml;
                resultObservedSignsList.style.listStyle = 'none';
                resultObservedSignsList.style.paddingLeft = '0px';
                resultObservedSignsList.style.marginLeft = '0px';
            }

            if (resultInterpretationText) {
                resultInterpretationText.innerHTML = data.interpretation
                    ? `<p>${data.interpretation}</p>`
                    : '<p>Thermal readings are within normal ranges for broiler chickens.<br>Head temperature is between 40.0–42.5°C, and body temperature is stable at 37.5–39.0°C.<br>No signs of fever or irregular heat distribution detected.<br>The bird appears healthy with no indication of infection.</p>';
            }

            if (resultRecommendedActionsList) {
                let actionsHtml = '';
                if (data.recommended_actions) {
                    actionsHtml = data.recommended_actions.split('\n').map(action => `<li><i class="bi bi-check-circle text-primary me-2"></i>${action}</li>`).join('');
                } else {
                    actionsHtml = `
                                <li><i class="bi bi-check-circle text-primary me-2"></i>Continue routine observation of the bird.</li>
                                <li><i class="bi bi-check-circle text-primary me-2"></i>Maintain proper nutrition and hydration.</li>
                                <li><i class="bi bi-check-circle text-primary me-2"></i>Ensure housing area remains well-ventilated and clean.</li>
                                <li><i class="bi bi-check-circle text-primary me-2"></i>Re-scan periodically to confirm stable health status.</li>
                            `;
                }
                resultRecommendedActionsList.innerHTML = actionsHtml;
                resultRecommendedActionsList.style.listStyle = 'none';
                resultRecommendedActionsList.style.paddingLeft = '0px';
                resultRecommendedActionsList.style.marginLeft = '0px';
            }
        } else if (originalStatus === 'Fever Only') {
            // Fever Only specific content
            if (resultObservedSignsList) {
                let signsHtml = '';
                if (data.temperatures && typeof data.temperatures === 'object') {
                    const headTemp = (data.temperatures.head !== undefined && data.temperatures.head !== null) ? Number(data.temperatures.head).toFixed(2) : 'N/A';
                    const bodyTemp = (data.temperatures.body !== undefined && data.temperatures.body !== null) ? Number(data.temperatures.body).toFixed(2) : 'N/A';
                    const bodyMin = (data.temperatures.body_min !== undefined && data.temperatures.body_min !== null) ? Number(data.temperatures.body_min).toFixed(2) : (bodyTemp !== 'N/A' ? (parseFloat(bodyTemp) - 0.5).toFixed(2) : 'N/A');
                    const bodyMax = (data.temperatures.body_max !== undefined && data.temperatures.body_max !== null) ? Number(data.temperatures.body_max).toFixed(2) : (bodyTemp !== 'N/A' ? (parseFloat(bodyTemp) + 0.5).toFixed(2) : 'N/A');
                    const deltaT = bodyMin !== 'N/A' && bodyMax !== 'N/A' ? (parseFloat(bodyMax) - parseFloat(bodyMin)).toFixed(1) : 'N/A';
                    const headStatus = headTemp !== 'N/A' && parseFloat(headTemp) > 42.5 ? 'Above normal' : 'Normal';
                    const deltaTStatus = deltaT !== 'N/A' && parseFloat(deltaT) < 1.0 ? 'Uniform heat distribution' : 'Non-uniform heat distribution';
                    const legTemp = (data.temperatures.leg !== undefined && data.temperatures.leg !== null && data.temperatures.leg !== 'N/A') ? Number(data.temperatures.leg).toFixed(2) : 'N/A';
                    const legStatus = legTemp !== 'N/A' && parseFloat(legTemp) >= 38.0 ? 'Normal' : (legTemp === 'N/A' ? 'N/A' : 'Below normal');
                    signsHtml += `<li><i class="bi bi-thermometer-half text-warning me-2"></i>Head Temperature: <strong>${headTemp} °C</strong> — ${headStatus}</li>`;
                    signsHtml += `<li><i class="bi bi-thermometer-half text-warning me-2"></i>Body Temperature: <strong>${bodyTemp} °C</strong></li>`;
                    signsHtml += `<li><i class="bi bi-thermometer-half text-warning me-2"></i>Leg Temperature: <strong>${legTemp === 'N/A' ? 'N/A' : legTemp + ' °C'}</strong>${legTemp !== 'N/A' ? ' — ' + legStatus : ''}</li>`;
                } else {
                    const avgTemp = data.average_temperature ? Number(data.average_temperature).toFixed(2) : 'N/A';
                    signsHtml += `<li><i class="bi bi-thermometer-half text-warning me-2"></i>Head Temperature: <strong>${avgTemp} °C</strong> — Normal</li>`;
                    signsHtml += `<li><i class="bi bi-thermometer-half text-warning me-2"></i>Body Mean Temperature: <strong>${avgTemp} °C</strong></li>`;
                    signsHtml += `<li><i class="bi bi-thermometer-half text-warning me-2"></i>Body Variation: <strong>N/A</strong> — N/A</li>`;
                }
                resultObservedSignsList.innerHTML = signsHtml;
                resultObservedSignsList.style.listStyle = 'none';
                resultObservedSignsList.style.paddingLeft = '0px';
                resultObservedSignsList.style.marginLeft = '0px';
            }

            if (resultInterpretationText) {
                resultInterpretationText.innerHTML = data.interpretation
                    ? `<p>${data.interpretation}</p>`
                    : '<p>Head temperature is slightly elevated with uniform heat distribution.<br>This suggests a systemic fever, possibly indicating early infection.<br>Monitor closely for changes in temperature patterns.</p>';
            }

            if (resultRecommendedActionsList) {
                let actionsHtml = '';
                if (data.recommended_actions) {
                    actionsHtml = data.recommended_actions.split('\n').map(action => `<li><i class="bi bi-exclamation-triangle text-warning me-2"></i>${action}</li>`).join('');
                } else {
                    actionsHtml = `
                        <li><i class="bi bi-exclamation-triangle text-warning me-2"></i>Monitor the bird closely for any changes in temperature or behavior.</li>
                        <li><i class="bi bi-exclamation-triangle text-warning me-2"></i>Ensure proper ventilation and reduce stress factors.</li>
                        <li><i class="bi bi-exclamation-triangle text-warning me-2"></i>Consult a veterinarian if symptoms persist.</li>
                    `;
                }
                resultRecommendedActionsList.innerHTML = actionsHtml;
                resultRecommendedActionsList.style.listStyle = 'none';
                resultRecommendedActionsList.style.paddingLeft = '0px';
                resultRecommendedActionsList.style.marginLeft = '0px';
            }
        } else {
            // Suspected birdflu or other - analyze signs that led to classification
            if (resultObservedSignsList) {
                let signsHtml = '';
                let signsDetected = [];

                if (data.temperatures && typeof data.temperatures === 'object') {
                    const headTemp = (data.temperatures.head !== undefined && data.temperatures.head !== null) ? Number(data.temperatures.head).toFixed(2) : null;
                    const bodyMean = (data.temperatures.body !== undefined && data.temperatures.body !== null) ? Number(data.temperatures.body).toFixed(2) : null;
                    const bodyMin = (data.temperatures.body_min !== undefined && data.temperatures.body_min !== null) ? Number(data.temperatures.body_min).toFixed(2) : null;
                    const bodyMax = (data.temperatures.body_max !== undefined && data.temperatures.body_max !== null) ? Number(data.temperatures.body_max).toFixed(2) : null;
                    const legTemp = (data.temperatures.leg !== undefined && data.temperatures.leg !== null && data.temperatures.leg !== 'N/A') ? Number(data.temperatures.leg).toFixed(2) : null;

                    // Check for signs that match backend classification logic
                    if (headTemp !== null && parseFloat(headTemp) >= 43.0) {
                        signsDetected.push('high_head_temp');
                    }
                    if (bodyMin !== null && bodyMax !== null && (parseFloat(bodyMax) - parseFloat(bodyMin)) > 6.0) {
                        signsDetected.push('irregular_body_temp');
                    }
                    if (legTemp !== null && parseFloat(legTemp) < 38.0) {
                        signsDetected.push('low_leg_temp');
                    }

                    // Display head temperature
                    if (headTemp !== null) {
                        const headStatus = parseFloat(headTemp) >= 43.0 ? '⚠️ Very high fever (>43°C)' :
                                         parseFloat(headTemp) > 42.5 ? '⚠️ Above healthy range (40.0–42.5°C)' :
                                         'Within healthy range';
                        signsHtml += `<li><i class="bi bi-thermometer-high text-danger me-2"></i>Head Temperature: <strong>${headTemp} °C</strong> — ${headStatus}</li>`;
                    } else {
                        signsHtml += `<li><i class="bi bi-thermometer-high text-secondary me-2"></i>Head Temperature: <strong>N/A</strong></li>`;
                    }

                    // Display body temperature with min/max
                    if (bodyMean !== null && bodyMin !== null && bodyMax !== null) {
                        const bodyVariation = parseFloat(bodyMax) - parseFloat(bodyMin);
                        const bodyStatus = bodyVariation > 6.0 ? `⚠️ Irregular heat distribution (${bodyVariation.toFixed(1)}°C variation)` :
                                         'Stable heat distribution';
                        signsHtml += `<li><i class="bi bi-thermometer-half text-warning me-2"></i>Body Temperature: <strong>${bodyMean} °C</strong> (min: ${bodyMin}°C, max: ${bodyMax}°C) — ${bodyStatus}</li>`;
                    } else if (bodyMean !== null) {
                        signsHtml += `<li><i class="bi bi-thermometer-half text-warning me-2"></i>Body Temperature: <strong>${bodyMean} °C</strong></li>`;
                    } else {
                        signsHtml += `<li><i class="bi bi-thermometer-half text-secondary me-2"></i>Body Temperature: <strong>N/A</strong></li>`;
                    }

                    // Display leg temperature
                    if (legTemp !== null) {
                        const legStatus = parseFloat(legTemp) < 38.0 ? '⚠️ Below normal (<38°C)' : 'Normal';
                        signsHtml += `<li><i class="bi bi-thermometer-low text-info me-2"></i>Leg Temperature: <strong>${legTemp} °C</strong> — ${legStatus}</li>`;
                    } else {
                        signsHtml += `<li><i class="bi bi-thermometer-low text-secondary me-2"></i>Leg Temperature: <strong>N/A</strong></li>`;
                    }

                    // Show detected signs summary for Suspected Bird Flu
                    if (originalStatus === 'Suspected Bird Flu' && signsDetected.length > 0) {
                        signsHtml += `<li><strong><i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>Critical Signs Detected:</strong> ${signsDetected.join(', ').replace(/_/g, ' ')}</li>`;
                    }

                } else {
                    signsHtml += `<li>Head Temperature: <strong>N/A</strong></li>`;
                    signsHtml += `<li>Body Temperature: <strong>N/A</strong></li>`;
                    signsHtml += `<li>Leg Temperature: <strong>N/A</strong></li>`;
                }
                resultObservedSignsList.innerHTML = signsHtml;
                resultObservedSignsList.style.listStyle = 'none';
                resultObservedSignsList.style.paddingLeft = '0px';
                resultObservedSignsList.style.marginLeft = '0px';
            }

            if (resultInterpretationText) {
                let interpretation = data.interpretation || '';

                if (!interpretation) {
                    if (originalStatus === 'Suspected Bird Flu') {
                        interpretation = 'Critical bird flu symptoms detected: High head temperature (≥43°C), irregular body temperature variation (>6°C difference), and low leg temperature (<38°C). This combination strongly indicates avian influenza infection. Immediate isolation and veterinary intervention required.';
                    } else {
                        interpretation = 'Thermal analysis reveals abnormal heat distribution patterns suggesting possible infection or illness. Multiple temperature irregularities detected requiring immediate attention.';
                    }
                }

                resultInterpretationText.innerHTML = `<p>${interpretation}</p>`;
            }

            if (resultRecommendedActionsList) {
                let actionsHtml = '';
                if (data.recommended_actions) {
                    actionsHtml = data.recommended_actions.split('\n').map(action => `<li><i class="bi bi-exclamation-triangle text-danger me-2"></i>${action}</li>`).join('');
                } else {
                    if (originalStatus === 'Suspected Bird Flu') {
                        actionsHtml = `
                            <li><i class="bi bi-exclamation-triangle text-danger me-2"></i><strong>IMMEDIATE ISOLATION:</strong> Separate the bird from the flock to prevent disease spread.</li>
                            <li><i class="bi bi-exclamation-triangle text-danger me-2"></i><strong>VETERINARY EMERGENCY:</strong> Contact avian veterinarian immediately for confirmatory testing.</li>
                            <li><i class="bi bi-exclamation-triangle text-danger me-2"></i><strong>BIOLOGICAL SECURITY:</strong> Implement strict biosecurity measures for the entire facility.</li>
                            <li><i class="bi bi-exclamation-triangle text-danger me-2"></i><strong>MORTALITY MONITORING:</strong> Track and report any additional bird deaths.</li>
                            <li><i class="bi bi-exclamation-triangle text-danger me-2"></i><strong>SAMPLE COLLECTION:</strong> Prepare samples for laboratory testing (swabs, blood).</li>
                        `;
                    } else {
                        actionsHtml = `
                            <li><i class="bi bi-exclamation-triangle text-danger me-2"></i>Monitor the bird closely for any changes in temperature or behavior.</li>
                            <li><i class="bi bi-exclamation-triangle text-danger me-2"></i>Isolate the bird to prevent potential spread.</li>
                            <li><i class="bi bi-exclamation-triangle text-danger me-2"></i>Consult a veterinarian for further evaluation.</li>
                            <li><i class="bi bi-exclamation-triangle text-danger me-2"></i>Implement biosecurity measures as a precaution.</li>
                        `;
                    }
                }
                resultRecommendedActionsList.innerHTML = actionsHtml;
                resultRecommendedActionsList.style.listStyle = 'none';
                resultRecommendedActionsList.style.paddingLeft = '0px';
                resultRecommendedActionsList.style.marginLeft = '0px';
            }
        }
    }

    // --- Save Report ---
    saveBtn.addEventListener('click', function () {
        const resultObservedSignsList = document.getElementById('resultObservedSignsList');
        const resultInterpretationText = document.getElementById('resultInterpretationText');
        const resultRecommendedActionsList = document.getElementById('resultRecommendedActionsList');

        const observedSigns = resultObservedSignsList ? Array.from(resultObservedSignsList.children).map(li => li.textContent.trim()) : [];
        const interpretation = resultInterpretationText ? resultInterpretationText.textContent.trim() : '';
        const recommendedActions = resultRecommendedActionsList ? Array.from(resultRecommendedActionsList.children).map(li => li.textContent.trim()) : [];

        const analysisData = {
            id: generateId(),
            date: new Date().toISOString(),
            chicken_id: resultChickenId.textContent,
            status: window.originalStatus || healthStatus.textContent.replace(/<[^>]*>/g, '').trim(),
            image: analyzedImage.src,
            heat_pattern_image: window.latestAnalysisData ? window.latestAnalysisData.heat_pattern_image || '' : '',
            details: [...observedSigns, `Interpretation: ${interpretation}`, ...recommendedActions],
            temperatures: window.latestAnalysisData ? window.latestAnalysisData.temperatures : undefined,
            average_temperature: window.latestAnalysisData ? window.latestAnalysisData.average_temperature : undefined,
            confidence: window.latestAnalysisData ? window.latestAnalysisData.confidence : undefined
        };

        // Send to backend API
        fetch('/api/save_analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(analysisData)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                saveNotification.style.display = 'block';
                setTimeout(() => saveNotification.style.display = 'none', 3000);
                document.dispatchEvent(new CustomEvent('analysisUpdated', { detail: analysisData }));
                resetForm();
            } else {
                alert('Error saving analysis: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error saving analysis:', error);
            alert('Error saving analysis: ' + error.message);
        });
    });

    // --- Helpers ---
    function resetForm() {
        fileInput.value = '';
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        uploadPlaceholder.classList.remove('hidden');
        analyzeBtn.style.display = 'none';
        analyzeBtn.disabled = true;
        saveBtn.style.display = 'none';
        resultContainer.style.display = 'none';
        cancelBtn.style.display = 'none';
        if (monitoringMessage) monitoringMessage.style.display = 'none';
        if (labTestMessage) labTestMessage.style.display = 'none';
        uploadedFile = null;
    }
    function generateId() {
        return 'analysis_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    function generateChickenId() {
        return uploadedFile ? uploadedFile.name : 'Unknown';
    }
});
