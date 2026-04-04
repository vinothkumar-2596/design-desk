import { createContext, useContext } from "react";

interface UnreadTaskNotificationsContextValue {
  ids: Set<string>;
  markTaskRead: (taskId: string) => void;
}

const DEFAULT: UnreadTaskNotificationsContextValue = {
  ids: new Set<string>(),
  markTaskRead: () => {},
};

export const UnreadTaskNotificationsContext = createContext<UnreadTaskNotificationsContextValue>(DEFAULT);

export const useUnreadTaskNotificationIds = () => useContext(UnreadTaskNotificationsContext).ids;
export const useMarkTaskRead = () => useContext(UnreadTaskNotificationsContext).markTaskRead;
