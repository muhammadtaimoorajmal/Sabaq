import { AnnouncementModel, AnnouncementReceiptModel } from './announcement.js';
import { ClassModel, MembershipModel } from './class.js';
import { CourseModel } from './course.js';
import { NotificationModel } from './notification.js';
import { StudySlotModel } from './planner.js';
import { JoinRequestModel, StudyGroupModel } from './study-group.js';
import { TaskCompletionModel, TaskModel } from './task.js';
import { UserModel } from './user.js';

export * from './announcement.js';
export * from './class.js';
export * from './course.js';
export * from './notification.js';
export * from './planner.js';
export * from './study-group.js';
export * from './task.js';
export * from './user.js';

/** Every Sabaq model, used to create indexes and to recognize Sabaq's own collections. */
export const ALL_MODELS = [
  UserModel,
  ClassModel,
  MembershipModel,
  CourseModel,
  TaskModel,
  TaskCompletionModel,
  AnnouncementModel,
  AnnouncementReceiptModel,
  StudySlotModel,
  StudyGroupModel,
  JoinRequestModel,
  NotificationModel,
] as const;
