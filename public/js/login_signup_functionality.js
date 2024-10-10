function switchOverlay(formType) {
    const loginFormContainer = document.getElementById('loginFormContainer');
    const signupFormContainer = document.getElementById('signupFormContainer');

    if (formType === 'signup') {
        loginFormContainer.classList.add('d-none'); // Hide login form
        signupFormContainer.classList.remove('d-none'); // Show signup form
    } else if (formType === 'login') {
        signupFormContainer.classList.add('d-none'); // Hide signup form
        loginFormContainer.classList.remove('d-none'); // Show login form
    }
}

function nextStep(stepNumber) {
    // Get the current active step
    const currentStep = document.querySelector('.step.active');

    // Find all required inputs in the current step
    const requiredInputs = currentStep.querySelectorAll('input[required], select[required]');
    
    // Variable to track whether all inputs are valid
    let allValid = true;

    // Loop through each required input and check if it's filled
    requiredInputs.forEach(input => {
        if (!input.value.trim()) {
            allValid = false; // Mark as invalid if any field is empty
            input.classList.add('is-invalid'); // Highlight empty fields (Bootstrap class)
        } else {
            input.classList.remove('is-invalid'); // Remove error class if valid
        }
    });

    // If all inputs are valid, go to the next step
    if (allValid) {
        currentStep.classList.remove('active'); // Hide current step
        document.getElementById('step-' + stepNumber).classList.add('active'); // Show next step
    }
}

function previousStep(stepNumber) {
    // Hide the currently active step
    document.querySelector('.step.active').classList.remove('active');
    // Show the previous step by adding the 'active' class
    document.getElementById('step-' + stepNumber).classList.add('active');
}

// Initially show Step 1
document.getElementById('step-1').classList.add('active');
