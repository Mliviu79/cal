"use client";

import { ShellMainAppDir } from "app/(use-page-wrapper)/(main-nav)/ShellMainAppDir";
import { TeamsCTA } from "app/(use-page-wrapper)/(main-nav)/teams/CTA";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { SkeletonText } from "@calcom/ui/components/skeleton";

export const TeamsListSkeleton = () => {
  const { t } = useLocale();
  return (
    <ShellMainAppDir
      heading={t("teams")}
      subtitle={t("create_manage_teams_collaborative")}
      CTA={<TeamsCTA />}>
      <SkeletonLoaderTeamList />
    </ShellMainAppDir>
  );
};

const SkeletonLoaderTeamList = () => (
  <div className="w-full">
    <ul className="bg-default divide-subtle border-subtle divide-y overflow-hidden rounded-md border">
      {Array.from({ length: 3 }).map((_, index) => (
        <SkeletonItem key={index} />
      ))}
    </ul>
  </div>
);

const SkeletonItem = () => (
  <li className="flex w-full items-center justify-between">
    <div className="flex items-center space-x-3 p-5 rtl:space-x-reverse">
      <SkeletonText className="h-8 w-8 rounded-full" />
      <div className="flex flex-col space-y-2">
        <SkeletonText className="h-4 w-32" />
        <SkeletonText className="h-3 w-24" />
      </div>
    </div>
    <div className="p-5">
      <div className="flex items-center space-x-2 rtl:space-x-reverse">
        <SkeletonText className="h-4 w-16" />
        <div className="flex space-x-2 rtl:space-x-reverse">
          <SkeletonText className="h-8 w-8 rounded" />
          <SkeletonText className="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
  </li>
);
