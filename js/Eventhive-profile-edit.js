// Edit Profile Page Functionality

document.addEventListener('DOMContentLoaded', function() {
  
  // ===== PHOTO UPLOAD FUNCTIONALITY =====
  
  // Cover Photo Upload
  const coverPhotoInput = document.getElementById('coverPhotoInput');
  const coverPhotoPreview = document.getElementById('coverPhotoPreview');
  
  if (coverPhotoInput) {
    coverPhotoInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          coverPhotoPreview.src = e.target.result;
          console.log('Cover photo updated');
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Profile Picture Upload
  const profilePicInput = document.getElementById('profilePicInput');
  const profilePicPreview = document.getElementById('profilePicPreview');
  
  if (profilePicInput) {
    profilePicInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          profilePicPreview.src = e.target.result;
          console.log('Profile picture updated');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // ===== BUTTON ACTIVE STATES =====
  
  // Profile Confirm/Save Button
  const saveProfileBtn = document.querySelector('.profile-action-buttons .btn-primary');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', function() {
      this.classList.add('active');
      setTimeout(() => {
        this.classList.remove('active');
      }, 300);
    });
  }
  
  // Password Form Login/Submit Button
  const passwordSubmitBtn = document.querySelector('.password-buttons .btn-primary');
  if (passwordSubmitBtn) {
    passwordSubmitBtn.addEventListener('click', function() {
      this.classList.add('active');
      setTimeout(() => {
        this.classList.remove('active');
      }, 300);
    });
  }

  // ===== PASSWORD FORM FUNCTIONALITY =====
  
  const passwordForm = document.getElementById('passwordForm');
  
  if (passwordForm) {
    passwordForm.addEventListener('submit', function(e) {
      e.preventDefault();
      
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Please fill in all password fields');
        return;
      }
      
      if (newPassword !== confirmPassword) {
        alert('New password and confirmation do not match');
        return;
      }
      
      if (newPassword.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
      }
      
      // If validation passes
      console.log('Password change submitted');
      alert('Password updated successfully!');
      resetPasswordForm();
    });
  }

  // ===== LOAD SAVED PROFILE DATA =====
  loadProfileData();

  // ===== UNSAVED CHANGES WARNING =====
  let hasUnsavedChanges = false;
  const inputs = document.querySelectorAll('input, textarea');
  
  inputs.forEach(input => {
    input.addEventListener('input', function() {
      hasUnsavedChanges = true;
    });
  });
  
  // Warn before leaving if there are unsaved changes
  window.addEventListener('beforeunload', function(e) {
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  });
  
  // Reset flag when saving
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', function() {
      hasUnsavedChanges = false;
    });
  }

});

// ===== SAVE PROFILE FUNCTION =====
function saveProfile() {
  const username = document.getElementById('usernameInput').value;
  const email = document.getElementById('emailInput').value;
  const description = document.getElementById('descriptionInput').value;
  
  // Validation
  if (!username || !email) {
    alert('Please fill in username and email');
    return;
  }
  
  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Please enter a valid email address');
    return;
  }
  
  // Save to localStorage (temporary storage)
  const profileData = {
    username: username,
    email: email,
    description: description,
    coverPhoto: document.getElementById('coverPhotoPreview').src,
    profilePic: document.getElementById('profilePicPreview').src,
    lastUpdated: new Date().toISOString()
  };
  
  localStorage.setItem('eventHiveProfile', JSON.stringify(profileData));
  
  console.log('Profile saved:', profileData);
  alert('Profile updated successfully!');
  
  // Redirect back to profile page
  setTimeout(() => {
    window.location.href = 'Profile-page.html';
  }, 1000);
}

// ===== RESET PASSWORD FORM =====
function resetPasswordForm() {
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
}

// ===== LOAD SAVED PROFILE DATA =====
function loadProfileData() {
  const savedProfile = localStorage.getItem('eventHiveProfile');
  
  if (savedProfile) {
    const profileData = JSON.parse(savedProfile);
    
    // Update form fields with saved data
    if (document.getElementById('usernameInput')) {
      document.getElementById('usernameInput').value = profileData.username || 'Username';
    }
    if (document.getElementById('emailInput')) {
      document.getElementById('emailInput').value = profileData.email || 'xxx@gmail.com';
    }
    if (document.getElementById('descriptionInput')) {
      document.getElementById('descriptionInput').value = profileData.description || '';
    }
    if (document.getElementById('coverPhotoPreview') && profileData.coverPhoto) {
      document.getElementById('coverPhotoPreview').src = profileData.coverPhoto;
    }
    if (document.getElementById('profilePicPreview') && profileData.profilePic) {
      document.getElementById('profilePicPreview').src = profileData.profilePic;
    }
    
    console.log('Profile data loaded from storage');
  }
}