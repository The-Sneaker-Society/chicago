const Query = {
  // hello: () => {
  //   return 'Hello world';
  // },
  // async emails(parent, args, ctx, info) {
  //   try {
  //     const emails = await EmailModel.find();
  //     return emails;
  //   } catch {
  //     throw new Error(e);
  //   }
  // },
  // async memberStatsById(parent, args, ctx, info) {
  //   try {
  //     // Find Member
  //     const member = await MemberModel.findById(args.id.toString());
  //     // Find Contracts of member.
  //     const contracts = await ContractModel.find({
  //       _id: { $in: member.contracts },
  //     });
  //     // Do stat calcs
  //     const notStarted = contracts.filter(
  //       (contract) => contract.stage === 'NOT_STARTED'
  //     );
  //     const started = contracts.filter(
  //       (contract) => contract.stage === 'STARTED'
  //     );
  //     const finished = contracts.filter(
  //       (contract) => contract.stage === 'FINISHED'
  //     );
  //     if (!member) {
  //       throw new Error('Member not found');
  //     }
  //     // return member;
  //     const stats = {
  //       id: args.id.toString(),
  //       notStarted: notStarted.length,
  //       started: started.length,
  //       finished: finished.length,
  //     };
  //     return stats;
  //   } catch (e) {
  //     throw new Error(e);
  //   }
  // },
};

export { Query as default };
