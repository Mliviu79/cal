import logger from "@calcom/lib/logger";
import { safeStringify } from "@calcom/lib/safeStringify";
import { prisma } from "@calcom/prisma";
import { AssignmentReasonEnum } from "@calcom/prisma/enums";

type RecordedReason = {
  reasonEnum: AssignmentReasonEnum;
  reasonString: string;
};

type RoutingFormRouteArgs = {
  bookingId: number;
  routingFormResponseId?: number | null;
  organizerId: number;
  teamId?: number | null;
  isRerouting?: boolean;
  reroutedByEmail?: string | null;
};

type CRMOwnershipArgs = {
  bookingId: number;
  crmAppSlug?: string | null;
  teamMemberEmail?: string | null;
  recordType?: string | null;
  routingFormResponseId?: number | null;
  recordId?: string | null;
};

export default class AssignmentReasonRecorder {
  private static log = logger.getSubLogger({ prefix: ["oss", "AssignmentReasonRecorder"] });

  private static async persistReason(
    bookingId: number,
    reasonEnum: AssignmentReasonEnum,
    reasonString: string
  ): Promise<RecordedReason> {
    return prisma.$transaction(async (tx) => {
      await tx.assignmentReason.deleteMany({ where: { bookingId } });
      await tx.assignmentReason.create({
        data: {
          bookingId,
          reasonEnum,
          reasonString,
        },
      });

      return { reasonEnum, reasonString };
    });
  }

  private static async updateRoutingResponseMessage(
    routingFormResponseId: number | null | undefined,
    reasonString: string
  ) {
    if (!routingFormResponseId) return;
    try {
      await prisma.routingFormResponseDenormalized.update({
        where: { id: routingFormResponseId },
        data: {
          bookingAssignmentReason: reasonString,
        },
      });
    } catch (error) {
      AssignmentReasonRecorder.log.warn(
        "Failed to update routing form response with assignment reason",
        safeStringify({ routingFormResponseId, error })
      );
    }
  }

  static async routingFormRoute(args: RoutingFormRouteArgs): Promise<RecordedReason> {
    const {
      bookingId,
      routingFormResponseId,
      organizerId,
      teamId,
      isRerouting,
      reroutedByEmail,
    } = args;

    const [organizer, team] = await Promise.all([
      prisma.user.findUnique({
        where: { id: organizerId },
        select: { name: true, email: true },
      }),
      teamId
        ? prisma.team.findUnique({
            where: { id: teamId },
            select: { name: true },
          })
        : Promise.resolve(null),
    ]);

    const organizerLabel = organizer?.name || organizer?.email || `user-${organizerId}`;
    const teamLabel = team?.name ? ` in ${team.name}` : "";
    const rerouteLabel = isRerouting
      ? ` after reroute${reroutedByEmail ? ` by ${reroutedByEmail}` : ""}`
      : "";

    const reasonEnum = organizer
      ? isRerouting
        ? AssignmentReasonEnum.REROUTED
        : AssignmentReasonEnum.ROUTING_FORM_ROUTING
      : AssignmentReasonEnum.ROUTING_FORM_ROUTING_FALLBACK;

    const reasonString = `Assigned to ${organizerLabel}${teamLabel} via routing form${rerouteLabel}.`;

    const recorded = await AssignmentReasonRecorder.persistReason(bookingId, reasonEnum, reasonString);
    await AssignmentReasonRecorder.updateRoutingResponseMessage(routingFormResponseId ?? null, reasonString);

    return recorded;
  }

  static async CRMOwnership(args: CRMOwnershipArgs): Promise<RecordedReason> {
    const { bookingId, crmAppSlug, teamMemberEmail, recordType, routingFormResponseId, recordId } = args;

    const ownerLabel = teamMemberEmail ? `owner ${teamMemberEmail}` : "CRM owner";
    const sourceLabel = crmAppSlug ? `from ${crmAppSlug}` : "from CRM";
    const recordLabel = [recordType, recordId].filter(Boolean).join(" ");
    const recordPhrase = recordLabel ? ` matched ${recordLabel}` : "";
    const reasonString = `${ownerLabel} ${sourceLabel}${recordPhrase} assigned this booking.`.trim();

    const recorded = await AssignmentReasonRecorder.persistReason(
      bookingId,
      AssignmentReasonEnum.SALESFORCE_ASSIGNMENT,
      reasonString
    );

    await AssignmentReasonRecorder.updateRoutingResponseMessage(routingFormResponseId ?? null, reasonString);

    return recorded;
  }
}
