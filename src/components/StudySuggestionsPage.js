import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
import { useAuth } from '../context/AuthContext';
import '../styles/Account.css';
import '../styles/StudySuggestionsPage.css';

const StudySuggestionsPage = () => {
  const { user: authUser, isLoggedIn } = useAuth();
  const [sleepSchedule, setSleepSchedule] = useState({
    bedtime: '00:00',
    wakeupTime: '08:00'
  });

  // Fetch sleep schedule from database when user is logged in
  useEffect(() => {
    if (isLoggedIn && authUser) {
      const fetchData = async () => {
        try {
          const response = await fetch(`/api/users/${authUser.id}/sleep-schedule`);
          if (response.ok) {
            const data = await response.json();
            console.log('Fetched sleep schedule:', data);
            setSleepSchedule({
              bedtime: data.bedtime,
              wakeupTime: data.wakeupTime
            });
          } else {
            throw new Error('Failed to fetch sleep schedule');
          }
        } catch (error) {
          console.error('Error fetching sleep schedule:', error);
          // Fall back to defaults if there's an error
          setSleepSchedule({
            bedtime: '00:00',
            wakeupTime: '08:00'
          });
        }
      };

      fetchData();
    }
  }, [isLoggedIn, authUser]);

  // Function to handle changes to sleep schedule inputs
  const handleSleepScheduleChange = async (e) => {
    const { name, value } = e.target;
    
    // Update local state first for immediate UI feedback
    setSleepSchedule(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Save to database if user is logged in
    if (isLoggedIn && authUser) {
      try {
        const updateData = { [name]: value };
        const response = await fetch(`/api/users/${authUser.id}/sleep-schedule`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        });
        
        if (response.ok) {
          console.log(`Updated ${name} to ${value} in database`);
        } else {
          throw new Error('Failed to update sleep schedule');
        }
        
        // Also update localStorage as a fallback
        localStorage.setItem(name, value);
      } catch (error) {
        console.error(`Error updating ${name}:`, error);
        // If API call fails, at least we have the value in localStorage
        localStorage.setItem(name, value);
      }
    }
  };

  // Function to calculate hours between bedtime and wakeup
  const calculateSleepHours = () => {
    if (!sleepSchedule.bedtime || !sleepSchedule.wakeupTime) {
      return 8; // Default to 8 hours if not set
    }
    
    // Parse times
    const [bedHours, bedMinutes] = sleepSchedule.bedtime.split(':').map(Number);
    const [wakeHours, wakeMinutes] = sleepSchedule.wakeupTime.split(':').map(Number);
    
    // Convert to minutes since midnight
    let bedTimeMinutes = bedHours * 60 + bedMinutes;
    let wakeTimeMinutes = wakeHours * 60 + wakeMinutes;
    
    // Calculate difference in minutes
    let diffMinutes = wakeTimeMinutes - bedTimeMinutes;
    if (diffMinutes < 0) {
      diffMinutes += 24 * 60; // Add a day in minutes
    }
    
    // Convert back to hours and minutes
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;

    return `${diffHours} hour${diffHours !== 1 ? 's' : ''}${remainingMinutes > 0 ? ` and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` : ''}`;
  };

  return (
    <div className="account-container">
      <h1 className="account-title">Study Suggestions</h1>
      
      <div className="account-section">
        <h2 className="section-title">Smart Preparation Planning</h2>
        
        <div className="preparation-section">
          <div className="sleep-schedule-form">
            <h4>Your Sleep Schedule</h4>
            <p className="sleep-schedule-description">
              Set your typical sleep hours so we can avoid scheduling preparation sessions during this time.
            </p>
            
            <div className="sleep-schedule-inputs">
              <div className="form-group">
                <label htmlFor="bedtime">
                  <FontAwesomeIcon icon={faMoon} className="schedule-icon" /> Bedtime
                </label>
                <input
                  type="time"
                  id="bedtime"
                  name="bedtime"
                  value={sleepSchedule.bedtime}
                  onChange={handleSleepScheduleChange}
                  className="time-input"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="wakeupTime">
                  <FontAwesomeIcon icon={faSun} className="schedule-icon" /> Wake-up Time
                </label>
                <input
                  type="time"
                  id="wakeupTime"
                  name="wakeupTime"
                  value={sleepSchedule.wakeupTime}
                  onChange={handleSleepScheduleChange}
                  className="time-input"
                />
              </div>
            </div>
            
            <p className="sleep-hours-note">
              We will not schedule any events during the {calculateSleepHours()} hours you are asleep.
            </p>
          </div>
          
          <div className="feature-description">
            <h4>How Kairos Helps You Prepare for Important Events</h4>
            
            <h5 style={{textDecoration: 'underline'}}>Setting Up Preparation Reminders</h5>
            <ul>
              <li>When creating a calendar event, check the <strong>"Requires Preparation"</strong> box for exams, assignments, or any event you need to prepare for.</li>
              <li>You can <strong>specify preparation hours immediately</strong>, or leave it blank to decide later.</li>
              <li>If you don't specify hours, Kairos will remind you <strong>2 weeks before the event</strong>.</li>
            </ul>
            
            <h5 style={{textDecoration: 'underline'}}>How the Preparation Planning Works</h5>
            <ul>
              <li><strong>Early Reminder:</strong> If you didn't specify preparation hours when creating the event, you'll receive a reminder <strong>2 weeks before</strong> the event asking how much time you need.</li>
              <li><strong>Preparation Suggestions:</strong> <strong>8 days before</strong> your event, Kairos will generate personalized preparation sessions based on your existing calendar commitments, the type of event, and your available free time.</li>
              <li><strong>Manual Generation:</strong> You can also click the <strong>"Generate Study Plan"</strong> button in an event's details at any time to immediately create preparation suggestions, even if the event is more than 8 days away.</li>
            </ul>
            
            <h5 style={{textDecoration: 'underline'}}>Adding Preparation Sessions to Your Calendar</h5>
            <ul>
              <li>Review the <strong>suggested preparation plan</strong></li>
              <li>Click <strong>"Accept"</strong> to add all sessions to your calendar</li>
              <li>Or <strong>select specific suggestions</strong> you would like to add to the calendar</li>
            </ul>
            
            <p>Your preparation sessions will appear in your calendar with <strong>reminders to help you stay on track!</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudySuggestionsPage;
