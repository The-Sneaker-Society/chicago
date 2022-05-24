// Contract between Member and Client

// Fields
const fields = {
  id, // from Mongo
  timestamps, // created and updated at from mongo
  Client, // setup already
  Member, // setup already
  eta, // Set by the Member
  status, // Stage of contract [qued, rejected, accepted]
  stage, // [Shipping, in progress, shipped to client],
  trackingNumbers: {
    incoming: "", // Tracking number to Member,
    outgoing: "", // Tracking number to Client
  },
  pictures, // jpeg. [{}]
  price, // string
  notes, // string
  conversation, // Convo type ID
  reported: false // triggered by Either client or member // Send email to CS
};

/* 
@todo

- Authentication on Member side and Client side firebase authentication - *one time code*

- photo upload service/functionality

- email service

- methods to update status

- method to update stage
- Messaging service
- Method to report
- Create url, to be created by the member (QR code, text, or email) 
        Ex www.sneakersociety.com/username/quotes
- Design email
*/
