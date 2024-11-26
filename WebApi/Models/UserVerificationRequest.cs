namespace SpoerStats2.Models
{
    public class UserVerificationRequest
    {
        public int UserId { get; set; } 
        public string HashedData { get; set; }
    }
}
