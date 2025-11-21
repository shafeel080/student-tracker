import { base44 } from "@/api/base44Client";

export const logAction = async (actionType, entityType, entityId, details, oldValue, newValue) => {
  try {
    const user = await base44.auth.me();
    
    await base44.entities.Log.create({
      timestamp: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      user_role: user.app_role,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      details: details ? JSON.stringify(details) : null,
      old_value: oldValue ? JSON.stringify(oldValue) : null,
      new_value: newValue ? JSON.stringify(newValue) : null,
      ip_address: null, // Browser doesn't have direct access to IP
      success: true
    });
  } catch (error) {
    console.error('Failed to log action:', error);
    // Don't throw - logging failures shouldn't break the app
  }
};

export const logError = async (actionType, entityType, errorMessage) => {
  try {
    const user = await base44.auth.me();
    
    await base44.entities.Log.create({
      timestamp: new Date().toISOString(),
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name,
      user_role: user.app_role,
      action_type: actionType,
      entity_type: entityType,
      details: errorMessage,
      success: false,
      error_message: errorMessage
    });
  } catch (error) {
    console.error('Failed to log error:', error);
  }
};