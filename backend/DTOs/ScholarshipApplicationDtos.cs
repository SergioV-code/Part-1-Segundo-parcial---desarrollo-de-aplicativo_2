using System.ComponentModel.DataAnnotations;

namespace EDUMETRICS_DR.DTOs;

public class CreateScholarshipApplicationRequest
{
    [Required]
    [MaxLength(180)]
    public string ScholarshipName { get; set; } = string.Empty;

    [Required]
    [MaxLength(180)]
    public string InstitutionName { get; set; } = string.Empty;

    [MaxLength(180)]
    public string? CareerName { get; set; }

    [MaxLength(2000)]
    public string? StudentComment { get; set; }
}

public class RejectScholarshipApplicationRequest
{
    [Required]
    [MinLength(5)]
    [MaxLength(2000)]
    public string RejectionReason { get; set; } = string.Empty;
}

public class CompleteScholarshipAnalysisRequest
{
    [Required]
    public bool FinancialAnalysisCompleted { get; set; }

    [Required]
    public bool SecondaryStudiesVerificationCompleted { get; set; }
}

public class ScholarshipApplicationHistoryDto
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string PreviousStatus { get; set; } = string.Empty;
    public string NewStatus { get; set; } = string.Empty;
    public string ActorRole { get; set; } = string.Empty;
    public string ActorEmail { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}

public class ScholarshipApplicationDto
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string StudentCedula { get; set; } = string.Empty;
    public string ScholarshipName { get; set; } = string.Empty;
    public string InstitutionName { get; set; } = string.Empty;
    public string CareerName { get; set; } = string.Empty;
    public string NotificationEmail { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string StudentComment { get; set; } = string.Empty;
    public string? RejectionReason { get; set; }
    public bool FinancialAnalysisCompleted { get; set; }
    public bool SecondaryStudiesVerificationCompleted { get; set; }
    public DateTime SubmittedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public List<ScholarshipApplicationHistoryDto> History { get; set; } = new();
}