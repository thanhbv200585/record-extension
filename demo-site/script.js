function nextStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(step => {
        step.classList.remove('active');
    });

    // Show target step
    document.getElementById(`step-${stepNumber}`).classList.add('active');

    // Update stepper UI
    document.querySelectorAll('.step').forEach(step => {
        const stepIdx = parseInt(step.getAttribute('data-step'));
        if (stepIdx <= stepNumber) {
            step.classList.add('active');
        } else {
            step.classList.remove('active');
        }
    });

    console.log(`Navigated to step ${stepNumber}`);
}

// File Upload Preview
document.addEventListener('change', (e) => {
    if (e.target.id === 'avatar') {
        const preview = document.getElementById('file-name-preview');
        if (e.target.files.length > 0) {
            const fileName = e.target.files[0].name;
            const fileSize = (e.target.files[0].size / 1024).toFixed(1);
            preview.innerHTML = `📄 <strong>Uploaded:</strong> ${fileName} (${fileSize} KB)`;
            preview.style.color = '#22c55e'; // Green for success
        } else {
            preview.innerHTML = '';
        }
    }
});

// Ensure the form doesn't actually submit
